import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@/hooks/useSolanaWallet';
import { useState } from 'react';
import { ChevronRight, Moon, Save, Sun } from 'lucide-react';

export default function SettingsPage() {
  const { connected } = useWallet();
  const [currentTab, setCurrentTab] = useState('general');
  
  // Just placeholders for UI demonstration
  const [settings, setSettings] = useState({
    general: {
      theme: 'dark',
      notifications: true,
      activityAlerts: true,
      priceAlerts: false,
      language: 'en',
      currency: 'usd'
    },
    network: {
      rpcUrl: 'https://api.devnet.solana.com',
      cluster: 'devnet',
      connectionTimeout: 30,
      autoReconnect: true,
      confirmationLevel: 'confirmed',
      maxRetries: 3
    },
    security: {
      autoLockTimeout: 15,
      requirePasswordForTx: true,
      hideBalances: false,
      advancedSecurity: false,
      approvedSites: []
    },
    display: {
      tokenDecimals: 4,
      hideSmallBalances: true,
      smallBalanceThreshold: 0.001,
      chartTimeframe: '7d',
      priceStyle: 'change'
    }
  });
  
  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };
  
  const handleSave = (category) => {
    // In a real app, this would save to backend/localStorage
    console.log(`Saving ${category} settings:`, settings[category]);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>
      
      <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] w-full sm:w-64 h-fit">
            <CardContent className="p-0">
              <TabsList className="flex flex-col w-full h-auto bg-transparent space-y-1 p-2">
                <TabsTrigger 
                  value="general" 
                  className="justify-start w-full px-3 py-2 data-[state=active]:bg-[#1e2a45] data-[state=active]:text-white"
                >
                  General
                </TabsTrigger>
                <TabsTrigger 
                  value="network" 
                  className="justify-start w-full px-3 py-2 data-[state=active]:bg-[#1e2a45] data-[state=active]:text-white"
                >
                  Network
                </TabsTrigger>
                <TabsTrigger 
                  value="security" 
                  className="justify-start w-full px-3 py-2 data-[state=active]:bg-[#1e2a45] data-[state=active]:text-white"
                >
                  Security
                </TabsTrigger>
                <TabsTrigger 
                  value="display" 
                  className="justify-start w-full px-3 py-2 data-[state=active]:bg-[#1e2a45] data-[state=active]:text-white"
                >
                  Display
                </TabsTrigger>
                <TabsTrigger 
                  value="advanced" 
                  className="justify-start w-full px-3 py-2 data-[state=active]:bg-[#1e2a45] data-[state=active]:text-white"
                >
                  Advanced
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>
          
          <div className="flex-1">
            <TabsContent value="general" className="mt-0">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">General Settings</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Configure basic application settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className="text-white font-medium">Theme</Label>
                        <p className="text-sm text-gray-400">Choose the application theme</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Sun className="text-gray-400 h-4 w-4" />
                        <Switch 
                          checked={settings.general.theme === 'dark'} 
                          onCheckedChange={(checked) => updateSetting('general', 'theme', checked ? 'dark' : 'light')}
                        />
                        <Moon className="text-gray-400 h-4 w-4" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Language</Label>
                      <Select 
                        value={settings.general.language}
                        onValueChange={(value) => updateSetting('general', 'language', value)}
                      >
                        <SelectTrigger className="bg-[#141c2f] border-[#1e2a45] text-white">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="de">Deutsch</SelectItem>
                          <SelectItem value="zh">中文</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Currency</Label>
                      <Select 
                        value={settings.general.currency}
                        onValueChange={(value) => updateSetting('general', 'currency', value)}
                      >
                        <SelectTrigger className="bg-[#141c2f] border-[#1e2a45] text-white">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usd">USD</SelectItem>
                          <SelectItem value="eur">EUR</SelectItem>
                          <SelectItem value="gbp">GBP</SelectItem>
                          <SelectItem value="jpy">JPY</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-white font-medium">Notifications</h3>
                      
                      <div className="flex justify-between items-center">
                        <Label className="text-gray-400">Enable notifications</Label>
                        <Switch 
                          checked={settings.general.notifications} 
                          onCheckedChange={(checked) => updateSetting('general', 'notifications', checked)}
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <Label className="text-gray-400">Activity alerts</Label>
                        <Switch 
                          checked={settings.general.activityAlerts} 
                          onCheckedChange={(checked) => updateSetting('general', 'activityAlerts', checked)}
                          disabled={!settings.general.notifications}
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <Label className="text-gray-400">Price alerts</Label>
                        <Switch 
                          checked={settings.general.priceAlerts} 
                          onCheckedChange={(checked) => updateSetting('general', 'priceAlerts', checked)}
                          disabled={!settings.general.notifications}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-[#1e2a45] flex justify-end">
                    <Button 
                      onClick={() => handleSave('general')}
                      className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="network" className="mt-0">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Network Settings</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Configure Solana network connection settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-white font-medium">RPC Endpoint</Label>
                      <Input 
                        className="bg-[#141c2f] border-[#1e2a45] text-white"
                        value={settings.network.rpcUrl}
                        onChange={(e) => updateSetting('network', 'rpcUrl', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Cluster</Label>
                      <Select 
                        value={settings.network.cluster}
                        onValueChange={(value) => updateSetting('network', 'cluster', value)}
                      >
                        <SelectTrigger className="bg-[#141c2f] border-[#1e2a45] text-white">
                          <SelectValue placeholder="Select cluster" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mainnet-beta">Mainnet Beta</SelectItem>
                          <SelectItem value="testnet">Testnet</SelectItem>
                          <SelectItem value="devnet">Devnet</SelectItem>
                          <SelectItem value="local">Localhost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Confirmation Level</Label>
                      <Select 
                        value={settings.network.confirmationLevel}
                        onValueChange={(value) => updateSetting('network', 'confirmationLevel', value)}
                      >
                        <SelectTrigger className="bg-[#141c2f] border-[#1e2a45] text-white">
                          <SelectValue placeholder="Select confirmation level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="finalized">Finalized</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="processed">Processed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Connection Timeout (seconds)</Label>
                      <Input 
                        type="number"
                        className="bg-[#141c2f] border-[#1e2a45] text-white"
                        value={settings.network.connectionTimeout}
                        onChange={(e) => updateSetting('network', 'connectionTimeout', parseInt(e.target.value))}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <Label className="text-gray-400">Auto Reconnect</Label>
                      <Switch 
                        checked={settings.network.autoReconnect} 
                        onCheckedChange={(checked) => updateSetting('network', 'autoReconnect', checked)}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-[#1e2a45] flex justify-end">
                    <Button 
                      onClick={() => handleSave('network')}
                      className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="security" className="mt-0">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Security Settings</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Configure security and privacy settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <Label className="text-white font-medium">Auto-lock Timeout</Label>
                          <p className="text-sm text-gray-400">Automatically lock after inactivity (minutes)</p>
                        </div>
                        <Input 
                          type="number"
                          className="bg-[#141c2f] border-[#1e2a45] text-white w-20"
                          value={settings.security.autoLockTimeout}
                          onChange={(e) => updateSetting('security', 'autoLockTimeout', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className="text-white font-medium">Password for Transactions</Label>
                        <p className="text-sm text-gray-400">Require password for all transactions</p>
                      </div>
                      <Switch 
                        checked={settings.security.requirePasswordForTx} 
                        onCheckedChange={(checked) => updateSetting('security', 'requirePasswordForTx', checked)}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className="text-white font-medium">Hide Balances</Label>
                        <p className="text-sm text-gray-400">Hide balances in the UI</p>
                      </div>
                      <Switch 
                        checked={settings.security.hideBalances} 
                        onCheckedChange={(checked) => updateSetting('security', 'hideBalances', checked)}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className="text-white font-medium">Advanced Security</Label>
                        <p className="text-sm text-gray-400">Enable additional security measures</p>
                      </div>
                      <Switch 
                        checked={settings.security.advancedSecurity} 
                        onCheckedChange={(checked) => updateSetting('security', 'advancedSecurity', checked)}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-[#1e2a45] flex justify-end">
                    <Button 
                      onClick={() => handleSave('security')}
                      className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="display" className="mt-0">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Display Settings</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Configure how data is displayed in the application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Token Decimals</Label>
                      <Select 
                        value={settings.display.tokenDecimals.toString()}
                        onValueChange={(value) => updateSetting('display', 'tokenDecimals', parseInt(value))}
                      >
                        <SelectTrigger className="bg-[#141c2f] border-[#1e2a45] text-white">
                          <SelectValue placeholder="Select decimal places" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 decimal places</SelectItem>
                          <SelectItem value="4">4 decimal places</SelectItem>
                          <SelectItem value="6">6 decimal places</SelectItem>
                          <SelectItem value="8">8 decimal places</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Default Chart Timeframe</Label>
                      <Select 
                        value={settings.display.chartTimeframe}
                        onValueChange={(value) => updateSetting('display', 'chartTimeframe', value)}
                      >
                        <SelectTrigger className="bg-[#141c2f] border-[#1e2a45] text-white">
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24h">24 hours</SelectItem>
                          <SelectItem value="7d">7 days</SelectItem>
                          <SelectItem value="30d">30 days</SelectItem>
                          <SelectItem value="90d">90 days</SelectItem>
                          <SelectItem value="1y">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className="text-white font-medium">Hide Small Balances</Label>
                        <p className="text-sm text-gray-400">Hide tokens with small balances</p>
                      </div>
                      <Switch 
                        checked={settings.display.hideSmallBalances} 
                        onCheckedChange={(checked) => updateSetting('display', 'hideSmallBalances', checked)}
                      />
                    </div>
                    
                    {settings.display.hideSmallBalances && (
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Small Balance Threshold ($)</Label>
                        <Input 
                          type="number"
                          className="bg-[#141c2f] border-[#1e2a45] text-white"
                          value={settings.display.smallBalanceThreshold}
                          onChange={(e) => updateSetting('display', 'smallBalanceThreshold', parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-[#1e2a45] flex justify-end">
                    <Button 
                      onClick={() => handleSave('display')}
                      className="bg-gradient-to-r from-primary to-[#7043f9] text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="advanced" className="mt-0">
              <Card className="bg-[#0f1421] shadow-xl border-[#1e2a45] mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Advanced Settings</CardTitle>
                  <CardDescription className="text-[#a3accd]">
                    Advanced configuration options (use with caution)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-amber-900/20 border border-amber-800/30 rounded-md mb-6">
                    <p className="text-amber-400 text-sm">
                      These settings are for advanced users only. Incorrect configuration may affect application functionality.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-between border-[#1e2a45] bg-[#141c2f] text-white">
                      <span>Reset Application Data</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-between border-[#1e2a45] bg-[#141c2f] text-white">
                      <span>Export Application Logs</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-between border-[#1e2a45] bg-[#141c2f] text-white">
                      <span>Developer Options</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}