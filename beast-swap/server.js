require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check route for Render
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Example payment route (Modify for Solana)
app.post("/pay", async (req, res) => {
    try {
        const { sender, amount } = req.body;
        if (!sender || !amount) {
            return res.status(400).json({ error: "Missing sender address or amount" });
        }

        // Process transaction logic here

        res.json({ message: "Payment received", sender, amount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
