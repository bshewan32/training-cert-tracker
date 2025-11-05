const express = require("express");
const router = express.Router();
const Certificate = require("../models/Certificate");
const UserToken = require("../models/UserToken");
const { authenticateToken } = require("../controllers/middleware/auth");
const upload = require("../controllers/middleware/upload");
const { Client } = require("@microsoft/microsoft-graph-client");
const msal = require("@azure/msal-node");
const mongoose = require('mongoose');
const { Readable } = require('stream');


let gridfsBucket = null;
async function getGridFSBucket() {
  if (mongoose.connection.readyState !== 1) {
    console.log("Waiting for MongoDB connection...");
    await mongoose.connection.asPromise(); // Ensure MongoDB is connected
  }

  if (!gridfsBucket) {
    // Create a GridFS bucket using mongoose's underlying MongoDB connection
    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'certfiles', // Specify your bucket name here
    });
  }

  return gridfsBucket;
}



// ---------- MSAL CONFIG (delegated flow) ----------
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET, // confidential web app
  },
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
    const err = new Error(
      "User not authenticated with Microsoft. Please sign in."
    );
    err.status = 401;
    throw err;
  }

  const tokenResponse = await cca.acquireTokenByRefreshToken({
    refreshToken: tokenDoc.refreshToken,
    scopes: ["Files.ReadWrite.All", "offline_access"],
  });

  if (
    tokenResponse?.refreshToken &&
    tokenResponse.refreshToken !== tokenDoc.refreshToken
  ) {
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
//

router.get("/auth/login", async (req, res) => {
  const authUrl = await cca.getAuthCodeUrl({
    scopes: ["Files.ReadWrite.All", "offline_access"],
    redirectUri: process.env.AZURE_REDIRECT_URI,
  });
  res.redirect(authUrl);
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

    res.send(
      "Microsoft login successful. You can close this tab and return to the app."
    );
  } catch (e) {
    console.error("Auth redirect error:", e);
    res.status(500).send("Auth error");
  }
});
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


router.post(
  "/upload-image",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { employeeName, certificateType, issueDate } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }
      if (!req.user?.id) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Toggle: default to Mongo GridFS unless explicitly using OneDrive
      const USE_ONEDRIVE = String(process.env.USE_ONEDRIVE).toLowerCase() === 'true';

      if (!USE_ONEDRIVE) {
        // ✅ Store file in MongoDB GridFS
        try {
          const bucket = getGridFSBucket();
          const readable = Readable.from(file.buffer);
          const filename = file.originalname || `certificate_${Date.now()}`;

          const uploadStream = bucket.openUploadStream(filename, {
            contentType: file.mimetype,
            metadata: {
              uploadedBy: req.user.id || null,
              employeeName: employeeName || null,
              certificateType: certificateType || null,
              issueDate: issueDate || null,
            },
          });

          readable
            .pipe(uploadStream)
            .on('error', (e) => {
              console.error('GridFS upload error:', e);
              return res.status(500).json({ message: 'Failed to store file', error: e.message });
            })
            .on('finish', () => {
              return res.json({
                ok: true,
                fileId: uploadStream.id.toString(), // GridFS ObjectId as string
                webUrl: null,
                filePath: filename,                 // keep a simple logical path/label
                message: "File stored in MongoDB",
              });
            });

          return; // important: stop here after piping
        } catch (e) {
          console.error('GridFS setup/store error:', e);
          return res.status(500).json({ message: 'Storage error', error: e.message });
        }
      }

      // 🔁 OneDrive/SharePoint path retained for optional use
      // 1) Get a fresh user access token from Mongo-stored refresh token
      const accessToken = await getUserAccessToken(req.user.id);
      const graphClient = getGraphClient(accessToken);

      // 2) Resolve the SharePoint site once per request (or cache this in memory)
      const SP_HOST = process.env.SP_HOST; // e.g. "yourtenant.sharepoint.com"
      const SP_SITE_PATH = process.env.SP_SITE_PATH; // e.g. "sites/Training"
      const site = await graphClient.api(`/sites/${SP_HOST}:/${SP_SITE_PATH}`).get();

      // 3) Build safe folder path + filename
      const safeEmployee = String(employeeName || "Unknown").replace(/[\\/:*?"<>|]/g, "-").trim();
      const safeCert = String(certificateType || "Certificate").replace(/[\\/:*?"<>|]/g, "-").trim();
      const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
      const folderPath = `Training Certificates/${safeEmployee}/${safeCert}`;
      const fileName = `${safeCert}_${issueDate || "unknown"}_${Date.now()}.${ext}`;

      // 4) Ensure nested folders exist
      const parts = folderPath.split("/").filter(Boolean);
      let currentPath = "";
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        try {
          await graphClient.api(`/sites/${site.id}/drive/root:/${currentPath}`).get();
        } catch {
          const parentPath = currentPath.includes("/")
            ? currentPath.substring(0, currentPath.lastIndexOf("/"))
            : "";
          await graphClient
            .api(`/sites/${site.id}/drive/root${parentPath ? `:/${parentPath}` : ""}:/children`)
            .post({
              name: part,
              folder: {},
              "@microsoft.graph.conflictBehavior": "rename",
            });
        }
      }

      // 5) Upload file
      const uploaded = await graphClient
        .api(`/sites/${site.id}/drive/root:/${folderPath}/${fileName}:/content`)
        .put(file.buffer);

      // 6) Return Graph IDs/links
      return res.json({
        ok: true,
        fileId: uploaded.id,
        webUrl: uploaded.webUrl,
        filePath: `/${folderPath}/${fileName}`,
        message: "File uploaded to SharePoint successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      const details = error.body || error.response?.data || error.message;
      return res.status(error.statusCode || 500).json({
        message: "Failed to upload file",
        error: details,
      });
    }
  }
);

// RENEW/UPDATE an existing certificate
router.post("/:id/renew", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const { issueDate, expirationDate, notes } = req.body;
    const file = req.file;

    // Find the certificate
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // Archive current version to revisions array (both storage types)
    certificate.revisions.push({
      issueDate: certificate.issueDate,
      expirationDate: certificate.expirationDate,
      onedriveFileId: certificate.onedriveFileId || null,
      onedriveFilePath: certificate.onedriveFilePath || null,
      gridFsFileId: certificate.gridFsFileId || null,
      gridFsFilename: certificate.gridFsFilename || null,
      originalFileName: certificate.originalFileName || null,
      status: certificate.status,
      archivedAt: new Date(),
      notes: notes || 'Previous version',
    });

    // Prepare new pointers defaulting to current (will be overwritten if new file uploaded)
    let newOneDriveId = certificate.onedriveFileId || null;
    let newOneDrivePath = certificate.onedriveFilePath || null;
    let newFileName = certificate.originalFileName || null;

    // Also track GridFS fields on the live record
    let newGridFsId = certificate.gridFsFileId || null;
    let newGridFsFilename = certificate.gridFsFilename || null;

    const USE_ONEDRIVE = String(process.env.USE_ONEDRIVE).toLowerCase() === 'true';

    // Upload new file if provided
    if (file) {
      if (USE_ONEDRIVE) {
        // ---------- OneDrive path ----------
        try {
          if (!req.user?.id) {
            return res.status(401).json({ message: "Not authenticated" });
          }

          const accessToken = await getUserAccessToken(req.user.id);
          const graphClient = getGraphClient(accessToken);

          const SP_HOST = process.env.SP_HOST;
          const SP_SITE_PATH = process.env.SP_SITE_PATH;
          const site = await graphClient.api(`/sites/${SP_HOST}:/${SP_SITE_PATH}`).get();

          const safeEmployee = String(certificate.staffMember || "Unknown")
            .replace(/[\\/:*?"<>|]/g, "-")
            .trim();
          const safeCert = String(certificate.certType || "Certificate")
            .replace(/[\\/:*?"<>|]/g, "-")
            .trim();
          const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
          const folderPath = `Training Certificates/${safeEmployee}/${safeCert}`;
          const fileName = `${safeCert}_${issueDate || "renewal"}_${Date.now()}.${ext}`;

          // ensure folders exist
          const parts = folderPath.split("/").filter(Boolean);
          let currentPath = "";
          for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            try {
              await graphClient.api(`/sites/${site.id}/drive/root:/${currentPath}`).get();
            } catch {
              const parentPath = currentPath.includes("/")
                ? currentPath.substring(0, currentPath.lastIndexOf("/"))
                : "";
              await graphClient
                .api(`/sites/${site.id}/drive/root${parentPath ? `:/${parentPath}` : ""}:/children`)
                .post({
                  name: part,
                  folder: {},
                  "@microsoft.graph.conflictBehavior": "rename",
                });
            }
          }

          const uploaded = await graphClient
            .api(`/sites/${site.id}/drive/root:/${folderPath}/${fileName}:/content`)
            .put(file.buffer);

          // set OneDrive pointers; clear GridFS (we're storing in OneDrive for this revision)
          newOneDriveId = uploaded.id;
          newOneDrivePath = `/${folderPath}/${fileName}`;
          newFileName = file.originalname;

          newGridFsId = null;
          newGridFsFilename = null;
        } catch (uploadError) {
          console.error("File upload error during renewal (OneDrive):", uploadError);
          // Continue renewal even if upload fails
        }
      } else {
        // ---------- Mongo GridFS path ----------
        try {
          const bucket = await getGridFSBucket();
          const readable = Readable.from(file.buffer);
          const filename = file.originalname || `certificate_${Date.now()}`;

          const uploadStream = bucket.openUploadStream(filename, {
            contentType: file.mimetype,
            metadata: {
              renewedFrom: certificate._id.toString(),
              by: req.user?.id || null,
            },
          });

          await new Promise((resolve, reject) => {
            readable.pipe(uploadStream).on('error', reject).on('finish', resolve);
          });

          // set GridFS pointers; clear OneDrive (we're storing in Mongo for this revision)
          newGridFsId = uploadStream.id;
          newGridFsFilename = filename;
          newFileName = filename;

          newOneDriveId = null;
          newOneDrivePath = null;
        } catch (e) {
          console.error("GridFS upload error during renewal:", e);
          // Continue renewal even if upload fails
        }
      }
    }

    // Update certificate with new data
    certificate.issueDate = new Date(issueDate);
    certificate.expirationDate = new Date(expirationDate);

    // Apply storage pointers based on what we just did
    certificate.onedriveFileId = newOneDriveId;
    certificate.onedriveFilePath = newOneDrivePath;
    certificate.gridFsFileId = newGridFsId;
    certificate.gridFsFilename = newGridFsFilename;
    certificate.originalFileName = newFileName;

    certificate.updatedAt = new Date();

    // Status recalculated by pre-save
    await certificate.save();

    res.json({
      message: "Certificate renewed successfully",
      certificate,
    });
  } catch (error) {
    console.error("Error renewing certificate:", error);
    res.status(500).json({
      message: "Failed to renew certificate",
      error: error.message,
    });
  }
});


// Also add a route to get revision history
router.get("/:id/history", authenticateToken, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    
    res.json({
      current: {
        issueDate: certificate.issueDate,
        expirationDate: certificate.expirationDate,
        status: certificate.status,
        onedriveFileId: certificate.onedriveFileId,
        updatedAt: certificate.updatedAt
      },
      revisions: certificate.revisions || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stream an image by certificate id (DELEGATED)
router.get('/:id/image', authenticateToken, async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });

    // ✅ Prefer Mongo GridFS
    if (cert.gridFsFileId) {
      const bucket = await getGridFSBucket();
      const { ObjectId } = mongoose.Types;
      // Try to get file doc to set Content-Type properly
      const files = await bucket.find({ _id: ObjectId(cert.gridFsFileId) }).toArray();

      if (!files.length) return res.status(404).json({ message: 'File not found' });

      const fileDoc = files[0];
      const mime =
        (fileDoc.contentType) ||
        (fileDoc.metadata && fileDoc.metadata.mimeType) ||
        'application/octet-stream';

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      const stream = bucket.openDownloadStream(fileDoc._id);
      stream.on('error', () => res.status(404).json({ message: 'File not found' }));
      return stream.pipe(res);
    }

    // 🔁 Legacy OneDrive fallback for old records (keep your existing code here)
    if (cert.onedriveFileId) {
      // ... existing Graph streaming logic ...
      return;
    }

    return res.status(404).json({ message: 'No stored image for this certificate' });
  } catch (e) {
    console.error('GET /:id/image error:', e);
    res.status(500).json({ message: 'Failed to fetch image' });
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
            $ifNull: [
              "$certificateTypeDetails.name",
              { $ifNull: ["$certType", "$CertType"] },
            ],
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
    if (!certificate)
      return res.status(404).json({ message: "Certificate not found" });

    if (certificate.onedriveFileId) {
      try {
        const appUserId = req.user?.id || req.user?._id || req.user;
        const accessToken = await getUserAccessToken(appUserId);
        const graphClient = getGraphClient(accessToken);
        const site = await graphClient
          .api(`/sites/${process.env.SP_HOST}:/${process.env.SP_SITE_PATH}`)
          .get();

        await graphClient
          .api(`/sites/${site.id}/drive/items/${certificate.onedriveFileId}`)
          .delete();
      } catch (e) {
        console.warn("Could not delete SharePoint file:", e?.message || e);
      }
    }

    await Certificate.findByIdAndDelete(req.params.id);
    res.json({
      message: "Certificate and associated file deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
