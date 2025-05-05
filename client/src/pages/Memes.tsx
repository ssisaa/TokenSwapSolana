import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Heart, Share2, Bookmark } from "lucide-react";

// Mock meme data
const popularMemes = [
  { 
    id: 1, 
    title: "When you finally understand liquidity pools", 
    image: "https://placehold.co/600x400/333/white?text=YOT+Meme", 
    author: "YOT_fan_01", 
    likes: 287, 
    comments: 42 
  },
  { 
    id: 2, 
    title: "Watching my YOT price go up", 
    image: "https://placehold.co/600x400/333/white?text=YOT+Meme", 
    author: "crypto_wizard", 
    likes: 194, 
    comments: 28 
  },
  { 
    id: 3, 
    title: "How it feels staking for the first time", 
    image: "https://placehold.co/600x400/333/white?text=YOT+Meme", 
    author: "staking_master", 
    likes: 312, 
    comments: 56 
  },
];

const newMemes = [
  { 
    id: 4, 
    title: "YOS rewards just dropped", 
    image: "https://placehold.co/600x400/333/white?text=YOT+Meme", 
    author: "yos_collector", 
    likes: 34, 
    comments: 7 
  },
  { 
    id: 5, 
    title: "POV: Checking your wallet after a month of staking", 
    image: "https://placehold.co/600x400/333/white?text=YOT+Meme", 
    author: "patient_holder", 
    likes: 56, 
    comments: 12 
  },
  { 
    id: 6, 
    title: "Me explaining YOT to my friends", 
    image: "https://placehold.co/600x400/333/white?text=YOT+Meme", 
    author: "crypto_evangelist", 
    likes: 87, 
    comments: 23 
  },
];

export default function Memes() {
  return (
    <DashboardLayout title="Memes">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">YOT Community Memes</h1>
          <p className="text-gray-400 mt-1">
            Share and enjoy memes from the YOT/YOS community
          </p>
        </div>

        <div className="mb-8">
          <Card className="bg-dark-200 border-dark-400 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                YOT
              </div>
              <div className="ml-3">
                <h3 className="text-white font-semibold">Create a Meme</h3>
                <p className="text-xs text-gray-400">Share your creativity with the community</p>
              </div>
            </div>
            
            <textarea 
              className="w-full bg-dark-300 border border-dark-400 text-white rounded-lg p-3 mb-3 h-20"
              placeholder="Write something funny about YOT/YOS..."
            ></textarea>
            
            <div className="flex justify-between">
              <Button variant="outline" className="bg-dark-300 border-dark-400 text-gray-300">
                Upload Image
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Post Meme
              </Button>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="popular" className="mb-6">
          <TabsList className="bg-dark-300 border-dark-400">
            <TabsTrigger value="popular" className="data-[state=active]:bg-primary-600 data-[state=active]:text-white">
              Popular
            </TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-primary-600 data-[state=active]:text-white">
              New
            </TabsTrigger>
            <TabsTrigger value="mine" className="data-[state=active]:bg-primary-600 data-[state=active]:text-white">
              My Posts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="popular" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularMemes.map(meme => (
                <MemeCard key={meme.id} meme={meme} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="new" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newMemes.map(meme => (
                <MemeCard key={meme.id} meme={meme} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="mine" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="h-12 w-12 text-gray-500 mb-4" />
              <h3 className="text-white font-medium mb-2">No memes posted yet</h3>
              <p className="text-gray-400 text-center max-w-md">
                Create and share your first meme with the YOT/YOS community. Show your creativity!
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

interface MemeCardProps {
  meme: {
    id: number;
    title: string;
    image: string;
    author: string;
    likes: number;
    comments: number;
  };
}

function MemeCard({ meme }: MemeCardProps) {
  return (
    <Card className="bg-dark-200 border-dark-400 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 rounded-full bg-dark-300 flex items-center justify-center text-white font-bold text-xs">
            {meme.author.charAt(0).toUpperCase()}
          </div>
          <div className="ml-2 text-sm text-white font-medium">{meme.author}</div>
        </div>
        <h3 className="text-white font-medium mb-3">{meme.title}</h3>
      </div>
      
      <img 
        src={meme.image} 
        alt={meme.title}
        className="w-full h-48 object-cover"
      />
      
      <div className="p-4 border-t border-dark-400 flex justify-between text-gray-400">
        <button className="flex items-center hover:text-primary-400">
          <Heart className="h-4 w-4 mr-1" />
          <span className="text-xs">{meme.likes}</span>
        </button>
        <button className="flex items-center hover:text-primary-400">
          <MessageCircle className="h-4 w-4 mr-1" />
          <span className="text-xs">{meme.comments}</span>
        </button>
        <button className="flex items-center hover:text-primary-400">
          <Share2 className="h-4 w-4 mr-1" />
          <span className="text-xs">Share</span>
        </button>
        <button className="flex items-center hover:text-primary-400">
          <Bookmark className="h-4 w-4 mr-1" />
          <span className="text-xs">Save</span>
        </button>
      </div>
    </Card>
  );
}