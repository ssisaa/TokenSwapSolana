import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Server } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface BlockchainErrorHandlerProps {
  error: Error | null;
  retry?: () => void;
  className?: string;
}

const errorMessages: Record<string, { title: string; description: string; }> = {
  'pool_balance': {
    title: 'Liquidity Pool Issue',
    description: 'Unable to fetch current pool balances from the blockchain. This could be due to network issues or the pool not being properly initialized.'
  },
  'exchange_rate': {
    title: 'Exchange Rate Unavailable',
    description: 'Cannot calculate exchange rates at this time. This could be due to network congestion or insufficient liquidity in the pool.'
  },
  'insufficient_liquidity': {
    title: 'Insufficient Liquidity',
    description: 'There is not enough liquidity in the pool to complete this operation. Please try a smaller amount or wait for more liquidity to be added.'
  },
  'token_balance': {
    title: 'Token Balance Error',
    description: 'Failed to retrieve token balance from the blockchain. This could be due to network issues or the token account not being found.'
  },
  'default': {
    title: 'Blockchain Connection Issue',
    description: 'There was a problem connecting to the Solana blockchain. Please check your network connection and try again.'
  }
};

export function BlockchainErrorHandler({ error, retry, className = '' }: BlockchainErrorHandlerProps) {
  // No error, don't render anything
  if (!error) {
    return null;
  }
  
  // Determine which error occurred based on the message
  const errorType = 
    error.message.includes('pool balance') || error.message.includes('Liquidity pool') ? 'pool_balance' :
    error.message.includes('exchange rate') || error.message.includes('rates from blockchain') ? 'exchange_rate' :
    error.message.includes('insufficient liquidity') || error.message.includes('Insufficient liquidity') ? 'insufficient_liquidity' :
    error.message.includes('token balance') ? 'token_balance' :
    'default';
  
  const { title, description } = errorMessages[errorType];
  
  return (
    <Alert variant="destructive" className={`border-destructive/30 bg-destructive/10 ${className}`}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">{description}</p>
        <div className="text-xs text-muted-foreground mb-2">
          {error.message}
        </div>
        {retry && (
          <Button 
            variant="outline"
            className="flex items-center gap-1 mt-2 bg-white/10"
            onClick={retry}
          >
            <RefreshCw className="h-3 w-3" /> Refresh Data
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// This error handler is specifically for displaying blockchain data errors in places where we don't want to disrupt the entire UI
export function SilentBlockchainErrorHandler({ error, retry }: BlockchainErrorHandlerProps) {
  if (!error) return null;
  
  return (
    <div className="flex items-center text-destructive text-sm gap-1 mt-1">
      <Server className="h-3 w-3" />
      <span>Blockchain data unavailable</span>
      {retry && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 px-1 text-xs"
          onClick={retry}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> 
          Retry
        </Button>
      )}
    </div>
  );
}