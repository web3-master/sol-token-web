import logo from './logo.svg';
import './App.css';
import { useState } from 'react';
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMint, createTransferInstruction, getMint, getOrCreateAssociatedTokenAccount, mintTo, Token, TOKEN_PROGRAM_ID} from '@solana/spl-token';

function App() {

  const [walletConnected, setWalletConnected] = useState(false);
  const [provider, setProvider] = useState();
  const [loading, setLoading] = useState();

  const [isTokenCreated, setIsTokenCreated] = useState(false);
  const [createdTokenPublicKey, setCreatedTokenPublicKey] = useState(null);
  const [mintingWalletSecretKey, setMintingWalletSecretKey] = useState(null);

  const [supplyCapped, setSupplyCapped] = useState(false);

  const getProvider = async () => {
    if ("solana" in window) {
      const provider = window.solana;
      if (provider.isPhantom) {
        return provider;
      }
    } else {
      window.open("https://www.phantom.app/", "_blank");
    }
  };

  const walletConnectionHelper = async () => {
    if (walletConnected) {
      setProvider();
      setWalletConnected(false);
    } else {
      const userWallet = await getProvider();
      if (userWallet) {
        await userWallet.connect();
        userWallet.on("connect", async () => {
          setProvider(userWallet);
          setWalletConnected(true);
        });
      }
    }
  }

  const airDropHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const fromAirDropSignature = await connection.requestAirdrop(new PublicKey(provider.publicKey), LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed"});

      console.log(`1 SOL airdropped to your wallet ${provider.publicKey.toString()} successfully`);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const initialMintHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      const mintRequester = await provider.publicKey;

      const mintingFromWallet = await Keypair.generate();
      setMintingWalletSecretKey(JSON.stringify(mintingFromWallet.secretKey));

      const fromAirDropSignature = await connection.requestAirdrop(mintingFromWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, {commitment: "confirmed"});

      const creatorToken = await createMint(connection, mintingFromWallet, mintingFromWallet.publicKey, null, 6);
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingFromWallet, creatorToken, mintingFromWallet.publicKey);

      mintTo(connection, mintingFromWallet, creatorToken, fromTokenAccount.address, mintingFromWallet, 1000000);

      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingFromWallet, creatorToken, mintRequester);

      const transaction = new Transaction().add(
        createTransferInstruction(fromTokenAccount.address, toTokenAccount.address, mintingFromWallet.publicKey, 1000000)
      );
      const signature = await sendAndConfirmTransaction(connection, transaction, [mintingFromWallet], {commitment: "confirmed"});
      console.log("SIGNATURE", signature);

      setCreatedTokenPublicKey(creatorToken);
      setIsTokenCreated(true);

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const mintAgainHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const mintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const mintRequester = await provider.publicKey;

      const fromAirDropSignature = await connection.requestAirdrop(mintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, {commitment: "confirmed"});

      const creatorToken = await getMint(connection, createdTokenPublicKey);

      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingWallet, creatorToken.address, mintingWallet.publicKey);
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingWallet, creatorToken.address, mintRequester);
      await mintTo(connection, mintingWallet, creatorToken.address, fromTokenAccount.address, mintingWallet, 100000000);

      const transaction = new Transaction().add(
        createTransferInstruction(fromTokenAccount.address, toTokenAccount.address, mintingWallet.publicKey, 100000000)
      );
      await sendAndConfirmTransaction(connection, transaction, [mintingWallet], {commitment: "confirmed"});

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const transferTokenHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      const mintingWallet = Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const receiverWallet = new PublicKey("5eaFQvgJgvW4rDjcAaKwdBb6ZAJ6avWimftFyjnQB3Aj");

      const creatorToken = await getMint(connection, createdTokenPublicKey);

      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingWallet, creatorToken.address, mintingWallet.publicKey);
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingWallet, creatorToken.address, receiverWallet);

      const transaction = new Transaction().add(
        createTransferInstruction(fromTokenAccount.address, toTokenAccount.address, mintingWallet.publicKey, 10000000)
      );
      transaction.feePayer = await provider.publicKey;
      let blockhashObj = await connection.getRecentBlockhash();
      console.log("blockhashObj", blockhashObj);
      transaction.recentBlockhash = await blockhashObj.blockhash;

      if (transaction) {
        console.log("Txn created successfully");
      }

      let signed = await provider.signTransaction(transaction);
      let signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      console.log("SIGNATURE", signature);

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Create your own token using JavaScript</h1>
      {walletConnected ? (<p><strong>Public Key: </strong>{provider.publicKey.toString()}</p>) : <p></p>}

      <button onClick={walletConnectionHelper} disabled={loading}>
        {!walletConnected ? "Connect Wallet" : "Disconnect Wallet"}
      </button>

      {walletConnected ? (
        <>
        <p>
          Airdrop 1 SOL into your wallet
          <button disabled={loading} onClick={airDropHelper}>
            AirDrop SOL
          </button>
        </p>

        <p>
          Create your own token
          <button disabled={loading} onClick={initialMintHelper}>
            Initial Mint
          </button>
        </p>

        <p>
          Mint More 100 tokens
          <button disabled={loading || supplyCapped} onClick={mintAgainHelper}>
            Mint Again
          </button>
        </p>

        <p>
          Send 10 tokens to friend
          <button disabled={loading} onClick={transferTokenHelper}>
            Transfer
          </button>
        </p>
        </>
      ) : <p></p>}
    </div>
  );
}

export default App;
