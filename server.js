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
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(SOLANA_RPC_URL);
const BEAST_MEME_TOKEN_MINT = new PublicKey(process.env.TOKEN_ADDRESS); // Token mint address
const EXCHANGE_RATE = 100000000; // 1 SOL = 100,000,000 BEAST MEME
const MIN_PURCHASE_SOL = 0.1;

// 🔹 Load the wallets
const solWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOL_WALLET_PRIVATE_KEY)));
const tokenWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.TOKEN_WALLET_PRIVATE_KEY)));

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

        if (amount < MIN_PURCHASE_SOL) {
            return res.status(400).json({ error: `Minimum purchase amount is ${MIN_PURCHASE_SOL} SOL` });
        }

        // 🔹 Calculate BEAST MEME amount to send
        const beastMemeAmount = amount * EXCHANGE_RATE;

        // 🔹 Get sender's associated token account for BEAST MEME
        const senderPublicKey = new PublicKey(sender);
        const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            tokenWallet,
            BEAST_MEME_TOKEN_MINT,
            senderPublicKey
        );

        // 🔹 Get merchant's associated token account for BEAST MEME
        const merchantTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            tokenWallet,
            BEAST_MEME_TOKEN_MINT,
            tokenWallet.publicKey
        );

        // 🔹 Create token transfer transaction
        const transaction = new Transaction().add(
            createTransferInstruction(
                merchantTokenAccount.address,
                senderTokenAccount.address,
                tokenWallet.publicKey,
                beastMemeAmount,
                [],
                TOKEN_PROGRAM_ID
            )
        );

        // 🔹 Sign and send transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [tokenWallet]);

        res.json({
            message: "Payment successful",
            transactionId: signature,
            amountReceived: beastMemeAmount
        });

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
