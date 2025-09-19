const express = require("express");
const router = express.Router();
const Certificate = require("../models/Certificate");
const UserToken = require("../models/UserToken");
const { authenticateToken } = require("../controllers/middleware/auth");
const upload = require("../controllers/middleware/upload");
const { Client } = require("@microsoft/microsoft-graph-client");
const msal = require("@azure/msal-node");

// ---------- MSAL CONFIG (delegated flow) ----------
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET, // confidential web app
  }
};
const cca = new msal.ConfidentialClientApplication(msalConfig);

// Helper: build Graph client with a USER access token
const getGraphClient = (userAccessToken) => {
  return Client.init({
    authProvider: (done) => done(null, userAccessToken),
  });
};

// Helper: get a fresh user access token for this app user (uses Mongo-stored refresh token)
async function getUserAccessToken(appUserId) {
  const tokenDoc = await UserToken.findOne({ userId: appUserId });
  if (!tokenDoc) {
    const err = new Error("User not authenticated with Microsoft. Please sign in.");
    err.status = 401;
    throw err;
  }

  const tokenResponse = await cca.acquireTokenByRefreshToken({
    refreshToken: tokenDoc.refreshToken,
    scopes: ["Files.ReadWrite.All", "offline_access"],
  });

  if (tokenResponse?.refreshToken && tokenResponse.refreshToken !== tokenDoc.refreshToken) {
    tokenDoc.refreshToken = tokenResponse.refreshToken;
    tokenDoc.scopes = tokenResponse.scopes || tokenDoc.scopes;
    tokenDoc.expiresOn = tokenResponse.expiresOn || tokenDoc.expiresOn;
    await tokenDoc.save();
  }

  if (!tokenResponse?.accessToken) {
    const err = new Error("Could not acquire Microsoft access token.");
    err.status = 401;
    throw err;
  }

  return tokenResponse.accessToken;
}


// ---------- AUTH ROUTES (delegated) ----------
// Step 1: redirect user to Microsoft login (request delegated scopes)
router.get("/auth/login", authenticateToken, async (req, res) => {
  try {
    const authUrl = await cca.getAuthCodeUrl({
      scopes: ["Files.ReadWrite.All", "offline_access"],
      redirectUri: process.env.AZURE_REDIRECT_URI,
    });
    res.redirect(authUrl);
  } catch (e) {
    console.error("Auth login error:", e);
    res.status(500).send("Auth error");
  }
});

// Step 2: MS redirects here; exchange code for tokens and persist refresh token
router.get("/auth/redirect", authenticateToken, async (req, res) => {
  try {
    const tokenResponse = await cca.acquireTokenByCode({
      code: req.query.code,
      scopes: ["Files.ReadWrite.All", "offline_access"],
      redirectUri: process.env.AZURE_REDIRECT_URI,
    });

    if (!req.user?.id) {
      throw new Error("Missing app user id from JWT");
    }

    await UserToken.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        account: {
          homeAccountId: tokenResponse.account?.homeAccountId,
          environment: tokenResponse.account?.environment,
          tenantId: tokenResponse.account?.tenantId,
          username: tokenResponse.account?.username,
        },
        refreshToken: tokenResponse.refreshToken,
        scopes: tokenResponse.scopes || [],
        expiresOn: tokenResponse.expiresOn || null,
      },
      { upsert: true }
    );

    res.send("Microsoft login successful. You can close this tab and return to the app.");
  } catch (e) {
    console.error("Auth redirect error:", e);
    res.status(500).send("Auth error");
  }
});
;

// ---------- YOUR EXISTING ROUTES ----------

// POST new certificate (unchanged)
router.post("/upload", authenticateToken, async (req, res) => {
  try {
    const certificate = new Certificate({
      staffMember: req.body.staffMember,
      position: req.body.position,
      certType: req.body.certificateType,
      issueDate: req.body.issueDate,
      expirationDate: req.body.expirationDate,
      documentPath: req.body.documentPath || "pending",
      onedriveFileId: req.body.onedriveFileId || null,
      onedriveFilePath: req.body.onedriveFilePath || null,
    });
    const saved = await certificate.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error saving certificate:", error);
    res.status(400).json({ message: error.message });
  }
});

// Upload certificate image to SharePoint (DELEGATED)
// Upload certificate image to SharePoint (DELEGATED)
router.post("/upload-image", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const { employeeName, certificateType, issueDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // 1) Get a fresh user access token from Mongo-stored refresh token
    const accessToken = await getUserAccessToken(req.user.id);
    const graphClient = getGraphClient(accessToken);

    // 2) Resolve the SharePoint site once per request (or cache this in memory)
    const SP_HOST = process.env.SP_HOST;           // e.g. "gordonmckayelectrical.sharepoint.com"
    const SP_SITE_PATH = process.env.SP_SITE_PATH; // e.g. "sites/Training"
    const site = await graphClient.api(`/sites/${SP_HOST}:/${SP_SITE_PATH}`).get();

    // 3) Build safe folder path + filename
    const safeEmployee = String(employeeName || "Unknown").replace(/[\\/:*?"<>|]/g, "-").trim();
    const safeCert = String(certificateType || "Certificate").replace(/[\\/:*?"<>|]/g, "-").trim();
    const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
    const folderPath = `Training Certificates/${safeEmployee}/${safeCert}`;
    const fileName = `${safeCert}_${issueDate || "unknown"}_${Date.now()}.${ext}`;

    // 4) Ensure nested folders exist (idempotent mkdir -p behavior)
    const parts = folderPath.split("/").filter(Boolean);
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      try {
        await graphClient.api(`/sites/${site.id}/drive/root:/${currentPath}`).get();
      } catch {
        const parentPath = currentPath.includes("/") ? currentPath.substring(0, currentPath.lastIndexOf("/")) : "";
        await graphClient
          .api(`/sites/${site.id}/drive/root${parentPath ? `:/${parentPath}` : ""}:/children`)
          .post({
            name: part,
            folder: {},
            "@microsoft.graph.conflictBehavior": "rename",
          });
      }
    }

    // 5) Upload file (simple PUT for small files; switch to upload session if you ever go > 250MB)
    const uploaded = await graphClient
      .api(`/sites/${site.id}/drive/root:/${folderPath}/${fileName}:/content`)
      .put(file.buffer);

    // 6) Return the Graph IDs/links — save these on your certificate document if you like
    return res.json({
      ok: true,
      fileId: uploaded.id,
      webUrl: uploaded.webUrl,                 // direct link workers can open in SP
      filePath: `/${folderPath}/${fileName}`,  // your logical path
      message: "File uploaded to SharePoint successfully",
    });
  } catch (error) {
    console.error("SharePoint upload error:", error);
    const details = error.body || error.response?.data || error.message;
    return res.status(error.statusCode || 500).json({
      message: "Failed to upload file to SharePoint",
      error: details,
    });
  }
});


// Stream an image by certificate id (DELEGATED)
router.get("/:id/image", authenticateToken, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate || !certificate.onedriveFileId) {
      return res.status(404).json({ message: "Certificate image not found" });
    }

    const appUserId = req.user?.id || req.user?._id || req.user;
    const accessToken = await getUserAccessToken(appUserId);
    const graphClient = getGraphClient(accessToken);

    const site = await graphClient
      .api(`/sites/${process.env.SP_HOST}:/${process.env.SP_SITE_PATH}`)
      .get();

    const fileStream = await graphClient
      .api(`/sites/${site.id}/drive/items/${certificate.onedriveFileId}/content`)
      .getStream();

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({ message: "Failed to fetch image", error: error.message });
  }
});

// List certificates (unchanged)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const certificates = await Certificate.aggregate([
      {
        $lookup: {
          from: "certificatetypes",
          localField: "certType",
          foreignField: "name",
          as: "certificateTypeDetails",
        },
      },
      {
        $unwind: {
          path: "$certificateTypeDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          certificateName: {
            $ifNull: ["$certificateTypeDetails.name", { $ifNull: ["$certType", "$CertType"] }],
          },
          validityPeriod: "$certificateTypeDetails.validityPeriod",
          status: {
            $cond: {
              if: { $lt: ["$expirationDate", new Date()] },
              then: "EXPIRED",
              else: "ACTIVE",
            },
          },
        },
      },
    ]);
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a certificate (optional: also delete the file from the site drive)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) return res.status(404).json({ message: "Certificate not found" });

    if (certificate.onedriveFileId) {
      try {
        const appUserId = req.user?.id || req.user?._id || req.user;
        const accessToken = await getUserAccessToken(appUserId);
        const graphClient = getGraphClient(accessToken);
        const site = await graphClient.api(`/sites/${process.env.SP_HOST}:/${process.env.SP_SITE_PATH}`).get();

        await graphClient.api(`/sites/${site.id}/drive/items/${certificate.onedriveFileId}`).delete();
      } catch (e) {
        console.warn("Could not delete SharePoint file:", e?.message || e);
      }
    }

    await Certificate.findByIdAndDelete(req.params.id);
    res.json({ message: "Certificate and associated file deleted successfully" });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
