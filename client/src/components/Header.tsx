import WalletConnect from "@/components/WalletConnect";

export default function Header() {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-center mb-10">
      <div className="flex items-center mb-4 sm:mb-0">
        <div className="bg-primary-600 rounded-full w-10 h-10 flex items-center justify-center mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">YOT Swap</h1>
      </div>
      
      <WalletConnect />
    </header>
  );
}
