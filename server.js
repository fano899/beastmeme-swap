require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction
} = require("@solana/web3.js");

// ✅ Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Solana Configuration
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(SOLANA_RPC_URL, "finalized"); // Use "finalized" for higher reliability
const BEAST_MEME_TOKEN_MINT = new PublicKey("6Pp23Lbn2Dywh9dz6hEZcTyH6Tbq4B4JXXcD1eAwLdV8"); 
const EXCHANGE_RATE = 100000000; // 1 SOL = 100,000,000 BEAST MEME
const MIN_PURCHASE_SOL = 0.1;

// 🔹 Load Seller's Private Key from Environment
const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY)));

// ✅ Health Check
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// ✅ Payment Route (Handles SOL ➝ BEAST MEME)
app.post("/pay", async (req, res) => {
    try {
        const { sender, amount } = req.body;
        if (!sender || !amount || isNaN(amount)) {
            return res.status(400).json({ error: "Invalid sender or amount" });
        }

        // 🔹 Enforce Minimum Purchase Amount
        if (amount < MIN_PURCHASE_SOL) {
            return res.status(400).json({ error: `Minimum purchase amount is ${MIN_PURCHASE_SOL} SOL` });
        }

        // 🔹 Calculate BEAST MEME Amount to Send
        const beastMemeAmount = amount * EXCHANGE_RATE;

        // 🔹 Get Latest Blockhash to Avoid Expiry
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

        // 🔹 Create Transaction
        const transaction = new Transaction({
            recentBlockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight + 150 // Increase expiry buffer
        }).add(
            SystemProgram.transfer({
                fromPubkey: sellerKeypair.publicKey,
                toPubkey: new PublicKey(sender),
                lamports: beastMemeAmount,
            })
        );

        // 🔹 Sign and Send Transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [sellerKeypair], {
            commitment: "finalized"
        });

        res.json({ message: "Payment successful", transactionId: signature, amountReceived: beastMemeAmount });

    } catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
