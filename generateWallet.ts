import { Keypair } from "@solana/web3.js"
import { DISTRIBUTION_WALLETNUM } from "./constants"
import { DataBuyAmount } from "./src/types"
import { saveDataToFile } from "./utils"
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"

let kps: Keypair[] = []

const main = async () => {
    for (let i = 0; i < DISTRIBUTION_WALLETNUM; i++) {
        const wallet = Keypair.generate()
        kps.push(wallet)
    }

    const dataWallet: DataBuyAmount[] = [];
    kps.map((data) => (dataWallet.push({ walletPub: bs58.encode(data.secretKey), amount: 0.0001 })))

    saveDataToFile(dataWallet)
}

main()