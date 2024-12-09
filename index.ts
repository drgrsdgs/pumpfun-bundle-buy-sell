import { VersionedTransaction, Keypair, SystemProgram, Connection, TransactionInstruction, TransactionMessage, PublicKey } from "@solana/web3.js"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import base58 from "bs58"
import { DISTRIBUTION_WALLETNUM, JITO_FEE, MINT_ADDRESS, PRIVATE_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "./constants"
import { readJson } from "./utils"
import { PumpFunSDK } from "./src/pumpfun";
import { executeJitoTx } from "./executor/jito";



const commitment = "confirmed"
const connection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment
})
const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
let kps: Keypair[] = []

const mintAddress = new PublicKey(MINT_ADDRESS)
let sdk = new PumpFunSDK(new AnchorProvider(connection, new NodeWallet(new Keypair()), { commitment }));

const main = async () => {

    const amount = readJson()
    kps = readJson().map(kpStr => Keypair.fromSecretKey(base58.decode(kpStr.walletPub)))

    const buyIxs: TransactionInstruction[] = []

    for (let i = 0; i < DISTRIBUTION_WALLETNUM; i++) {
        const ix = await makeBuyIx(kps[i], Math.floor(amount[i].amount * 10 ** 9))
        buyIxs.push(...ix)
    }

    const latestBlockhash = await connection.getLatestBlockhash()
    const transactions: VersionedTransaction[] = [];
    const jitofee_createToken_ixs = await jito_createToken_Tx();

    const jitoTx = new VersionedTransaction(
        new TransactionMessage({
            payerKey: mainKp.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: jitofee_createToken_ixs
        }).compileToV0Message()
    )
    jitoTx.sign([mainKp])
    transactions.push(jitoTx)
    for (let i = 0; i < Math.ceil(DISTRIBUTION_WALLETNUM / 4); i++) {
        const latestBlockhash = await connection.getLatestBlockhash()
        const instructions: TransactionInstruction[] = []

        const start = i * 4
        const end = (i + 1) * 4 < DISTRIBUTION_WALLETNUM ? (i + 1) * 4 : DISTRIBUTION_WALLETNUM

        for (let j = start; j < end; j++) {
            if (kps[j])
                instructions.push(buyIxs[j * 2], buyIxs[j * 2 + 1])
        }
        const msg = new TransactionMessage({
            payerKey: mainKp.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions
        }).compileToV0Message()

        const tx = new VersionedTransaction(msg)
        tx.sign([mainKp])
        for (let j = start; j < end; j++) {
            if (kps[j])
                tx.sign([kps[j]])
        }
        transactions.push(tx)
    }
    await executeJitoTx(transactions, mainKp, commitment)
}
const jito_createToken_Tx = async () => {

    const ixs: TransactionInstruction[] = []
    const tipAccounts = [
        'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
        '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
        '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
        'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
        'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
        'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
        'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    ];
    const jitoFeeWallet = new PublicKey(tipAccounts[Math.floor(tipAccounts.length * Math.random())])
    ixs.push(SystemProgram.transfer({
        fromPubkey: mainKp.publicKey,
        toPubkey: jitoFeeWallet,
        lamports: Math.floor(JITO_FEE * 10 ** 9),
    }))
    return ixs
}

const makeBuyIx = async (kp: Keypair, buyAmount: number) => {
    let buyIx = await sdk.getBuyInstructionsBySolAmount(
        kp.publicKey,
        mintAddress,
        BigInt(buyAmount),
        BigInt(5000),
        commitment
    );

    return buyIx

}

main()

