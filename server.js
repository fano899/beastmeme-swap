require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} = require("@solana/web3.js");
const {
    getOrCreateAssociatedTokenAccount,
    createTransferInstruction,
    TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Solana Configuration
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"; // ✅ Use Mainnet or Devnet
const connection = new Connection(SOLANA_RPC_URL);
const TOKEN_MINT = new PublicKey(process.env.TOKEN_ADDRESS); // ✅ Load token mint from .env
const EXCHANGE_RATE = 100000000; // 1 SOL = 100,000,000 BEAST MEME
const MIN_PURCHASE_SOL = 0.1; // 🔹 Minimum 0.1 SOL purchase

// 🔹 Load the seller's private key from .env file
const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOL_WALLET)));

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

        // 🔹 Enforce minimum purchase amount
        if (amount < MIN_PURCHASE_SOL) {
            return res.status(400).json({ error: `Minimum purchase amount is ${MIN_PURCHASE_SOL} SOL` });
        }

        // 🔹 Calculate BEAST MEME amount to send
        const beastMemeAmount = amount * EXCHANGE_RATE;

        // 🔹 Get the buyer's associated token account for BEAST MEME
        const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            sellerKeypair,
            TOKEN_MINT,
            new PublicKey(sender) // ✅ The buyer's wallet address
        );

        // 🔹 Get the seller's BEAST MEME token account
        const sellerTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            sellerKeypair,
            TOKEN_MINT,
            sellerKeypair.publicKey
        );

        // 🔹 Create a token transfer transaction
        const transaction = new Transaction().add(
            createTransferInstruction(
                sellerTokenAccount.address, // ✅ Seller's token account
                buyerTokenAccount.address, // ✅ Buyer's token account
                sellerKeypair.publicKey, // ✅ Seller (signer)
                beastMemeAmount, // ✅ Amount of BEAST MEME
                [],
                TOKEN_PROGRAM_ID
            )
        );

        // 🔹 Send transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [sellerKeypair]);

        res.json({ message: "Payment successful", transactionId: signature, amountReceived: beastMemeAmount });

    } catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
