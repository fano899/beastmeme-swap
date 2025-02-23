require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bs58 = require("bs58");
const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} = require("@solana/web3.js");

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Solana Configuration
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const BEAST_MEME_TOKEN_MINT = new PublicKey(process.env.TOKEN_ADDRESS);
const EXCHANGE_RATE = 100000000; // 1 SOL = 100,000,000 BEAST MEME
const MIN_PURCHASE_SOL = 0.1; // 🔹 Minimum 0.1 SOL purchase

// 🔹 Wallets
const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY)));
const solWallet = new PublicKey(process.env.SOL_WALLET);

// ✅ Health Check
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// ✅ Verify SOL Payment Before Sending BEAST MEME
async function verifySolPayment(sender, amount) {
    const confirmedTxs = await connection.getConfirmedSignaturesForAddress2(solWallet, { limit: 10 });
    
    for (let tx of confirmedTxs) {
        const transaction = await connection.getParsedTransaction(tx.signature, "confirmed");
        if (!transaction) continue;

        for (let instr of transaction.transaction.message.instructions) {
            if (instr.programId.toString() === SystemProgram.programId.toString() && instr.parsed.info.destination === solWallet.toString()) {
                const receivedSol = instr.parsed.info.lamports / LAMPORTS_PER_SOL;
                if (receivedSol === amount) {
                    return true;
                }
            }
        }
    }
    return false;
}

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

        // 🔹 Verify SOL Payment
        const paymentConfirmed = await verifySolPayment(sender, amount);
        if (!paymentConfirmed) {
            return res.status(400).json({ error: "No valid SOL transaction found for this amount." });
        }

        // 🔹 Calculate BEAST MEME amount to send
        const beastMemeAmount = amount * EXCHANGE_RATE;

        // 🔹 Transfer BEAST MEME to buyer
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: sellerKeypair.publicKey,
                toPubkey: new PublicKey(sender),
                lamports: beastMemeAmount, 
            })
        );

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


