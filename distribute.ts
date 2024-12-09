import { VersionedTransaction, Keypair, SystemProgram, Connection, ComputeBudgetProgram, TransactionInstruction, TransactionMessage } from "@solana/web3.js"
import base58 from "bs58"
import { DISTRIBUTION_WALLETNUM, PRIVATE_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "./constants"
import { readJson, sleep } from "./utils"
import { execute } from "./executor/legacy"


const commitment = "confirmed"
const connection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment
})
const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
let kps: Keypair[] = []

const main = async () => {

    console.log("Distributing SOL to wallets...")
    await distributeSol(connection, mainKp, DISTRIBUTION_WALLETNUM)
}

const distributeSol = async (connection: Connection, mainKp: Keypair, distritbutionNum: number) => {
    try {
        const sendSolTx: TransactionInstruction[] = []
        sendSolTx.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 })
        )
        const mainSolBal = await connection.getBalance(mainKp.publicKey)
        /* calulate mainSolBalance oneself because subwallet's balance has undefine yet */
        if (mainSolBal <= 4 * 10 ** 6) {
            console.log("Main wallet balance is not enough")
            return []
        }
        const dataBuy = readJson()

        for (let i = 0; i < DISTRIBUTION_WALLETNUM; i++) {
            sendSolTx.push(
                SystemProgram.transfer({
                    fromPubkey: mainKp.publicKey,
                    toPubkey: Keypair.fromSecretKey(base58.decode(dataBuy[i].walletPub)).publicKey,
                    lamports: Math.floor((dataBuy[i].amount + 0.005) * 10 ** 9)
                })
            )
        }

        let index = 0
        while (true) {
            try {
                if (index > 5) {
                    console.log("Error in distribution")
                    return null
                }
                const latestBlockhash = await connection.getLatestBlockhash()
                const messageV0 = new TransactionMessage({
                    payerKey: mainKp.publicKey,
                    recentBlockhash: latestBlockhash.blockhash,
                    instructions: sendSolTx,
                }).compileToV0Message()
                sleep(1000)
                const transaction = new VersionedTransaction(messageV0)
                transaction.sign([mainKp])
                let txSig = await execute(transaction, latestBlockhash, 1)

                if (txSig) {
                    const distibuteTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
                    console.log("SOL distributed ", distibuteTx)
                    break
                }
                index++
            } catch (error) {
                index++
            }
        }

        console.log("Success in distribution")
        return kps
    } catch (error) {
        console.log(`Failed to transfer SOL`, error)
        return null
    }
}

main()

