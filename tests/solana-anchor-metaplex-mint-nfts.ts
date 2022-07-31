import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaAnchorMetaplexMintNfts } from "../target/types/solana_anchor_metaplex_mint_nfts";

describe("solana-anchor-metaplex-mint-nfts", () => {
  const testNftTitle = "YouTube NFT";
  const testNftSymbol = "TUBE";
  const testNftUri =
    "https://raw.githubusercontent.com/gaylonalfano/solana-anchor-metaplex-mint-nfts/main/assets/example.json";

  const provider = anchor.AnchorProvider.env();
  // NOTE We use anchor.Wallet to help with typing
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SolanaAnchorMetaplexMintNfts as Program<SolanaAnchorMetaplexMintNfts>;

  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  it("Mint!", async () => {
    // 1. Derive the mint address of NFT and associated token account address
    // NOTE We just derive the account addresses on the Client-side, and then
    // let our program take care of creating the actual accounts
    const mintKeypair: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    const tokenAddress = await anchor.utils.token.associatedAddress({
      mint: mintKeypair.publicKey,
      owner: wallet.publicKey,
    });
    console.log(`New token: ${mintKeypair.publicKey}`);
    // 2. Derive the metadata account and master edition metadata account addresses
    // NOTE I believe we're using PDAs for these accounts. Specifically,
    // we're using findProgramAddress and passing it some seeds.
    // IMPORTANT This is finding an address (PDA, I think) on Solana that can exist with these seeds,
    // and we're going to use it to create the address (of metadata account) that points to the mint
    // We're ONLY finding the ADDRESS! Our program will do the actual creating of the metadata account!
    // Q: Do I need to wrap the await inside parens? (await anchor...)
    // const metadataAccountAddress = (
    //   await anchor.web3.PublicKey.findProgramAddress(
    //     [
    //       Buffer.from("metadata"),
    //       TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    //       mintKeypair.publicKey.toBuffer(),
    //     ],
    //     TOKEN_METADATA_PROGRAM_ID // Program that will own the PDA
    //   )
    // )[0]; // Just want the address
    let [metadataAccountAddress, metadataAccountBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID // Program that will own the PDA
      );
    console.log(
      `Metadata Account Address (PDA) initialized: ${metadataAccountAddress}`
    );

    // let masterEditionMetadataAccountAddress = (
    //   await anchor.web3.PublicKey.findProgramAddress(
    //     [
    //       Buffer.from("metadata"),
    //       TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    //       mintKeypair.publicKey.toBuffer(),
    //       Buffer.from("master-edition"),
    //     ],
    //     TOKEN_METADATA_PROGRAM_ID
    //   )
    // )[0]; // Just want the address
    let [
      masterEditionMetadataAccountAddress,
      masterEditionMetadataAccountBump,
    ] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
        Buffer.from("master-edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID // Program that will own the PDA
    ); // Just want the address
    console.log(
      `Master Edition Metadata Account Address (PDA) initialized: ${masterEditionMetadataAccountAddress}`
    );

    // 2. Transact with the mint_nft() fn in our on-chain program
    // NOTE This sends and confirms the transaction in one go!
    // FIXME: Encountered two errors when running anchor test:
    // -- One about metadata not being added correctly or at all
    // -- Two was the familiar ix error: instruction modified the
    // program ID of an account. In the past, this was space/size related...
    await program.methods
      .mintNft(testNftTitle, testNftSymbol, testNftUri)
      // NOTE We only provide the PublicKeys for all the accounts.
      // We do NOT have to deal with isSigner, isWritable, etc. like in RAW
      // since we already declared that in the program MintNft Context struct.
      // This means Anchor will look for all that info in our MintNft struct
      // ON ENTRY!
      .accounts({
        metadata: metadataAccountAddress,
        masterEditionMetadata: masterEditionMetadataAccountAddress,
        mint: mintKeypair.publicKey,
        tokenAccount: tokenAddress,
        mintAuthority: wallet.publicKey,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        // Q: What about the others (tokenProgram, associatedTokenProgram, rent, etc.)?
        // A: It's because Anchor automatically resolves these.
        // A: We add tokenMetadataProgram because it's UNCHECKED!
      })
      // NOTE I was right that the mintKeypair and wallet are signers,
      // but you don't pass wallet as signer for Anchor. It already knows.
      .signers([mintKeypair])
      .rpc();
  });
});
