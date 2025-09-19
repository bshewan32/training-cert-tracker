const express = require("express");
const router = express.Router();
const Certificate = require("../models/Certificate");
const { authenticateToken } = require("../controllers/middleware/auth");
const upload = require("../controllers/middleware/upload");
const { Client } = require("@microsoft/microsoft-graph-client");

// Microsoft Graph client setup
const getGraphClient = async () => {
  try {
    // Get access token using client credentials flow
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.AZURE_CLIENT_ID,
          client_secret: process.env.AZURE_CLIENT_SECRET,
          scope: "https://graph.microsoft.com/.default",
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();

    return Client.init({
      authProvider: (done) => {
        done(null, tokenData.access_token);
      },
    });
  } catch (error) {
    console.error("Error creating Graph client:", error);
    throw error;
  }
};

// POST new certificate
router.post("/upload", authenticateToken, async (req, res) => {
  try {
    console.log("Received data:", req.body);

    const certificate = new Certificate({
      staffMember: req.body.staffMember,
      position: req.body.position,
      certType: req.body.certificateType,
      issueDate: req.body.issueDate,
      expirationDate: req.body.expirationDate,
      documentPath: req.body.documentPath || "pending",
      // Add OneDrive fields
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

// Replace your OneDrive upload endpoint with SharePoint
router.post("/upload-image", upload.single("file"), async (req, res) => {
  try {
    const { employeeName, certificateType, issueDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    console.log("Starting SharePoint upload...");

    const graphClient = await getGraphClient();

    const siteName = process.env.SHAREPOINT_SITE_NAME; // "Training"
    const tenant = process.env.SHAREPOINT_TENANT; // "gordonmckayelectrical"
    const folderPath = `Training Certificates/${employeeName}`;
    const fileName = `${certificateType}_${issueDate}_${Date.now()}.${file.originalname
      .split(".")
      .pop()}`;

    console.log("SharePoint details:", { tenant, siteName, folderPath });

    // Get the site using the correct tenant format
    const siteResponse = await graphClient
      .api(`/sites/${tenant}.sharepoint.com:/sites/${siteName}`)
      .get();

    console.log("Site found:", siteResponse.id);

    // Create folder if it doesn't exist
    try {
      await graphClient
        .api(`/sites/${siteResponse.id}/drive/root:/${folderPath}`)
        .get();
    } catch (folderError) {
      console.log("Creating folder:", folderPath);
      // Create the folder
      const pathParts = folderPath.split("/");
      let currentPath = "";

      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        try {
          await graphClient
            .api(`/sites/${siteResponse.id}/drive/root:/${currentPath}`)
            .get();
        } catch (partError) {
          const parentPath = currentPath.substring(
            0,
            currentPath.lastIndexOf("/")
          );
          const folderName = currentPath.split("/").pop();

          await graphClient
            .api(
              `/sites/${siteResponse.id}/drive/root${
                parentPath ? ":/" + parentPath : ""
              }:/children`
            )
            .post({
              name: folderName,
              folder: {},
              "@microsoft.graph.conflictBehavior": "rename",
            });
        }
      }
    }

    // Upload file to SharePoint
    const uploadResponse = await graphClient
      .api(
        `/sites/${siteResponse.id}/drive/root:/${folderPath}/${fileName}:/content`
      )
      .put(file.buffer);

    console.log("File uploaded successfully:", uploadResponse.id);

    res.json({
      fileId: uploadResponse.id,
      filePath: `/${folderPath}/${fileName}`,
      message: "File uploaded to SharePoint successfully",
    });
  } catch (error) {
    console.error("SharePoint upload error:", error);
    console.error("Error response:", error.response?.data || error.body);

    res.status(500).json({
      message: "Failed to upload file to SharePoint",
      error: error.message,
    });
  }
});

router.get("/:id/image", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findById(id);

    if (!certificate || !certificate.onedriveFileId) {
      return res.status(404).json({ message: "Certificate image not found" });
    }

    const graphClient = await getGraphClient();
    const tenant = process.env.SHAREPOINT_TENANT;
    const siteName = process.env.SHAREPOINT_SITE_NAME;

    const siteResponse = await graphClient
      .api(`/sites/${tenant}.sharepoint.com:/sites/${siteName}`)
      .get();

    const fileStream = await graphClient
      .api(
        `/sites/${siteResponse.id}/drive/items/${certificate.onedriveFileId}/content`
      )
      .getStream();

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error fetching image:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch image", error: error.message });
  }
});

// ADD THIS INSTEAD:
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

// GET certificates by status
router.get("/status/:status", authenticateToken, async (req, res) => {
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
            $ifNull: ["$certificateTypeDetails.name", "$certType"],
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
      {
        $match: { status: req.params.status },
      },
    ]);
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ DELETE certificate by ID
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // Delete file from OneDrive if it exists
    if (certificate.onedriveFileId) {
      try {
        console.log("Deleting OneDrive file:", certificate.onedriveFileId);
        const graphClient = await getGraphClient();
        await graphClient
          .api(
            `/users/f9da6533-d022-40e9-a1ad-a96776677a26/drive/drive/items/${certificate.onedriveFileId}`
          )
          .delete();
        console.log("OneDrive file deleted successfully");
      } catch (oneDriveError) {
        console.warn("Could not delete OneDrive file:", oneDriveError.message);
        // Continue with certificate deletion even if OneDrive deletion fails
      }
    }

    // Delete from database
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
