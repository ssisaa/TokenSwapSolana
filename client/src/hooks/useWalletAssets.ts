import { useState, useEffect, useCallback } from 'react';
import { useMultiWallet } from '@/context/MultiWalletContext';
import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { ENDPOINT, YOT_TOKEN_ADDRESS, YOS_TOKEN_ADDRESS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Connection as NeonConnection } from '@neondatabase/serverless';

// Define types
export interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  iconClass?: string;
  address: string;
  decimals: number;
}

export interface NFTItem {
  name: string;
  collection: string;
  imageUrl: string;
  mintAddress: string;
  floor?: number;
}

export interface TransactionItem {
  type: 'send' | 'receive' | 'swap' | 'stake' | 'unstake' | 'harvest' | 'liquidity' | 'other';
  token?: string;
  amount?: number;
  date: string;
  status: 'confirmed' | 'processing' | 'failed';
  signature: string;
  from?: string;
  to?: string;
  tokenFrom?: string;
  amountFrom?: number;
  tokenTo?: string;
  amountTo?: number;
}

export function useWalletAssets() {
  const { connected, publicKey } = useMultiWallet();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const { toast } = useToast();

  // Token price cache
  const solPrice = 148.35; // In a production app, fetch this from a price API
  const yotPrice = 0.00000200;
  const yosPrice = 0.00002000;

  // Token info
  const tokenInfo = {
    SOL: { name: 'Solana', iconClass: 'bg-[#9945FF]', decimals: 9 },
    YOT: { name: 'Your Own Token', iconClass: 'bg-[#3e63dd]', decimals: 9 },
    YOS: { name: 'Your Own Story', iconClass: 'bg-[#10B981]', decimals: 9 },
  };

  // Fetch token balances
  const fetchTokenBalances = useCallback(async () => {
    if (!connected || !publicKey) return;

    setIsLoading(true);
    try {
      const connection = new Connection(ENDPOINT);

      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

      const tokenList: TokenBalance[] = [
        {
          symbol: 'SOL',
          name: 'Solana',
          balance: solBalanceFormatted,
          usdValue: solBalanceFormatted * solPrice,
          iconClass: 'bg-[#9945FF]',
          address: 'So11111111111111111111111111111111111111112',
          decimals: 9
        }
      ];

      // Fetch YOT balance
      try {
        const yotMint = new PublicKey(YOT_TOKEN_ADDRESS);
        const yotTokenAccount = await getAssociatedTokenAddress(yotMint, publicKey);
        
        try {
          const yotAccountInfo = await getAccount(connection, yotTokenAccount);
          const yotBalance = Number(yotAccountInfo.amount) / Math.pow(10, tokenInfo.YOT.decimals);
          
          tokenList.push({
            symbol: 'YOT',
            name: 'Your Own Token',
            balance: yotBalance,
            usdValue: yotBalance * yotPrice,
            iconClass: 'bg-[#3e63dd]',
            address: YOT_TOKEN_ADDRESS,
            decimals: tokenInfo.YOT.decimals
          });
        } catch (e) {
          // Account likely doesn't exist yet
          tokenList.push({
            symbol: 'YOT',
            name: 'Your Own Token',
            balance: 0,
            usdValue: 0,
            iconClass: 'bg-[#3e63dd]',
            address: YOT_TOKEN_ADDRESS,
            decimals: tokenInfo.YOT.decimals
          });
        }
      } catch (e) {
        console.error('Error fetching YOT balance', e);
      }

      // Fetch YOS balance
      try {
        const yosMint = new PublicKey(YOS_TOKEN_ADDRESS);
        const yosTokenAccount = await getAssociatedTokenAddress(yosMint, publicKey);
        
        try {
          const yosAccountInfo = await getAccount(connection, yosTokenAccount);
          const yosBalance = Number(yosAccountInfo.amount) / Math.pow(10, tokenInfo.YOS.decimals);
          
          tokenList.push({
            symbol: 'YOS',
            name: 'Your Own Story',
            balance: yosBalance,
            usdValue: yosBalance * yosPrice,
            iconClass: 'bg-[#10B981]',
            address: YOS_TOKEN_ADDRESS,
            decimals: tokenInfo.YOS.decimals
          });
        } catch (e) {
          // Account likely doesn't exist yet
          tokenList.push({
            symbol: 'YOS',
            name: 'Your Own Story',
            balance: 0,
            usdValue: 0,
            iconClass: 'bg-[#10B981]',
            address: YOS_TOKEN_ADDRESS,
            decimals: tokenInfo.YOS.decimals
          });
        }
      } catch (e) {
        console.error('Error fetching YOS balance', e);
      }

      // Get other SPL tokens (this would be expanded in a production app)
      setTokens(tokenList);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch token balances',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, toast]);

  // Fetch NFTs
  const fetchNFTs = useCallback(async () => {
    if (!connected || !publicKey) return;

    try {
      // In a production app, we would fetch real NFTs from the wallet
      // Here we're just populating sample data for the UI
      setNfts([
        {
          name: 'YOT NFT #123',
          collection: 'YOT Collection',
          imageUrl: 'https://via.placeholder.com/100',
          mintAddress: 'placeholder1',
          floor: 1.5
        },
        {
          name: 'YOS NFT #456',
          collection: 'YOS Collection',
          imageUrl: 'https://via.placeholder.com/100',
          mintAddress: 'placeholder2',
          floor: 0.8
        }
      ]);
    } catch (error) {
      console.error('Error fetching NFTs:', error);
    }
  }, [connected, publicKey]);

  // Parse and format transactions
  const parseTransactions = useCallback((txs: ParsedTransactionWithMeta[]): TransactionItem[] => {
    if (!publicKey) return [];

    return txs.map(tx => {
      // Use signature as unique ID
      const signature = tx.transaction.signatures[0];
      const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
      const dateStr = blockTime.toISOString().split('T')[0];

      // Simple transaction type detection - would be more sophisticated in production
      let type: TransactionItem['type'] = 'other';
      let token = 'SOL';
      let amount = 0;
      
      // Simplified detection logic
      if (tx.meta && tx.transaction.message.accountKeys.length > 0) {
        // Check if this is a transfer to/from the wallet
        const myAddress = publicKey.toString();
        const fromIndex = tx.transaction.message.accountKeys.findIndex(k => 
          k.pubkey.toString() === myAddress && k.signer);
          
        if (fromIndex >= 0) {
          type = 'send';
          // Calculate amount based on SOL balance change
          if (tx.meta.postBalances && tx.meta.preBalances) {
            amount = (tx.meta.preBalances[fromIndex] - tx.meta.postBalances[fromIndex]) / LAMPORTS_PER_SOL;
          }
        } else {
          // If not sent from us, but we're a recipient
          const toIndex = tx.transaction.message.accountKeys.findIndex(k => 
            k.pubkey.toString() === myAddress && !k.signer);
            
          if (toIndex >= 0) {
            type = 'receive';
            // Calculate amount based on SOL balance change
            if (tx.meta.postBalances && tx.meta.preBalances) {
              amount = (tx.meta.postBalances[toIndex] - tx.meta.preBalances[toIndex]) / LAMPORTS_PER_SOL;
            }
          }
        }
      }

      // Create transaction record
      return {
        type,
        token,
        amount,
        date: dateStr,
        status: 'confirmed',
        signature,
      };
    });
  }, [publicKey]);

  // Fetch transaction history
  const fetchTransactionHistory = useCallback(async () => {
    if (!connected || !publicKey) return;

    setTransactionsLoading(true);
    try {
      const connection = new Connection(ENDPOINT);
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
      
      if (signatures.length > 0) {
        const txs = await connection.getParsedTransactions(
          signatures.map(s => s.signature)
        );
        
        const parsedTxs = parseTransactions(txs.filter(Boolean) as ParsedTransactionWithMeta[]);
        setTransactions(parsedTxs);
      } else {
        // Sample data for demo (would be removed in production)
        setTransactions([
          { 
            type: 'send', 
            token: 'SOL', 
            amount: 0.5, 
            date: '2023-04-28', 
            status: 'confirmed',
            to: '8JzqAnf...',
            signature: 'sample1'
          },
          { 
            type: 'receive', 
            token: 'YOT', 
            amount: 1000, 
            date: '2023-04-27', 
            status: 'confirmed',
            from: '7m7RAFh...',
            signature: 'sample2'
          },
          { 
            type: 'swap', 
            tokenFrom: 'SOL', 
            amountFrom: 0.2, 
            tokenTo: 'YOT', 
            amountTo: 500, 
            date: '2023-04-25', 
            status: 'confirmed',
            signature: 'sample3'
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch transaction history',
        variant: 'destructive',
      });
    } finally {
      setTransactionsLoading(false);
    }
  }, [connected, publicKey, parseTransactions, toast]);

  // Refresh all wallet data
  const refreshWalletData = useCallback(() => {
    fetchTokenBalances();
    fetchNFTs();
    fetchTransactionHistory();
  }, [fetchTokenBalances, fetchNFTs, fetchTransactionHistory]);

  // Fetch data when wallet connection changes
  useEffect(() => {
    if (connected && publicKey) {
      refreshWalletData();
    } else {
      setTokens([]);
      setNfts([]);
      setTransactions([]);
    }
  }, [connected, publicKey, refreshWalletData]);

  return {
    tokens,
    nfts,
    transactions,
    isLoading,
    transactionsLoading,
    refreshWalletData
  };
}