const express = require("express");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.post("/generate-certificate", async (req, res) => {
  const { name, course, date } = req.body;

  try {
    const templatePath = path.join(
      __dirname,
      "../assets/certificate_template.pdf"
    );
    const existingPdfBytes = fs.readFileSync(templatePath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Adjust these values as per your Canva template layout
    firstPage.drawText(name, {
      x: 200,
      y: 300,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });

    firstPage.drawText(course, {
      x: 200,
      y: 260,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    firstPage.drawText(date, {
      x: 200,
      y: 220,
      size: 14,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const pdfBytes = await pdfDoc.save();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=certificate-${name}.pdf`,
    });

    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating certificate");
  }
});

module.exports = router;
