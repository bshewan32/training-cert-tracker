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

router.post("/upload-image", upload.single("file"), async (req, res) => {
  try {
    const { employeeName, certificateType, issueDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    console.log("Uploading file:", {
      employeeName,
      certificateType,
      issueDate,
      fileName: file.originalname,
    });

    // Initialize Microsoft Graph client
    const graphClient = await getGraphClient();

    // Create folder structure in OneDrive
    const folderPath = `/Training Certificates/${employeeName}`;
    const fileName = `${certificateType}_${issueDate}_${Date.now()}.${file.originalname
      .split(".")
      .pop()}`;
    const fullPath = `${folderPath}/${fileName}`;

    console.log("Uploading to path:", fullPath);

    // Create folder if it doesn't exist
    try {
      await graphClient.api(`/me/drive/root:${folderPath}`).get();
      console.log("Folder exists:", folderPath);
    } catch (folderError) {
      console.log("Creating folder:", folderPath);

      // Create folder structure step by step
      const pathParts = folderPath.split("/").filter((part) => part);
      let currentPath = "";

      for (const part of pathParts) {
        const parentPath = currentPath || "/";
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

        try {
          await graphClient.api(`/me/drive/root:${currentPath}`).get();
          console.log("Folder exists:", currentPath);
        } catch (partError) {
          console.log("Creating folder part:", currentPath);
          await graphClient
            .api(
              `/me/drive/root${
                parentPath === "/" ? "" : ":" + parentPath
              }:/children`
            )
            .post({
              name: part,
              folder: {},
              "@microsoft.graph.conflictBehavior": "rename",
            });
        }
      }
    }

    // Upload file to OneDrive
    console.log("Uploading file to OneDrive...");
    const uploadResponse = await graphClient
      .api(`/me/drive/root:${fullPath}:/content`)
      .put(file.buffer);

    console.log("File uploaded successfully:", uploadResponse.id);

    res.json({
      fileId: uploadResponse.id,
      filePath: fullPath,
      fileName: fileName,
      message: "File uploaded to OneDrive successfully",
    });
  } catch (error) {
    console.error("OneDrive upload error:", error);
    res.status(500).json({
      message: "Failed to upload file to OneDrive",
      error: error.message,
    });
  }
});

router.get("/:id/image", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Find certificate in database
    const certificate = await Certificate.findById(id);

    if (!certificate || !certificate.onedriveFileId) {
      return res.status(404).json({ message: "Certificate image not found" });
    }

    console.log(
      "Fetching image for certificate:",
      id,
      "File ID:",
      certificate.onedriveFileId
    );

    // Initialize Microsoft Graph client
    const graphClient = await getGraphClient();

    // Get file stream from OneDrive
    const fileStream = await graphClient
      .api(`/me/drive/items/${certificate.onedriveFileId}/content`)
      .getStream();

    // Set appropriate headers
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");

    // Pipe the file stream to response
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error fetching certificate image:", error);
    res.status(500).json({
      message: "Failed to fetch certificate image",
      error: error.message,
    });
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
          .api(`/me/drive/items/${certificate.onedriveFileId}`)
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
