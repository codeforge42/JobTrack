import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getScanConfig, updateScanConfig } from '@/services/admin-api';
import { ScanConfig } from '@/types';
import { useToast } from '@/hooks/use-toast';

const ConfigurationForm = () => {
  const [config, setConfig] = useState<ScanConfig>({
    scanFrequency: '24h',
    openAiApiKey: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const data = await getScanConfig();
        const config = {
          scanFrequency: data[0] as ScanConfig['scanFrequency'],
          openAiApiKey: data[1]
        };
        setConfig(config);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load configuration.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [toast]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.openAiApiKey) {
      toast({
        title: 'Error',
        description: 'OpenAI API key is required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await updateScanConfig(config);
      toast({
        title: 'Success',
        description: 'Configuration saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>
            Configure how often job listings should be scanned.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveConfig}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scan-frequency">Scan Frequency</Label>
              <Select
                value={config.scanFrequency}
                onValueChange={(value) => setConfig((prevConfig) => ({ ...prevConfig, scanFrequency: value as ScanConfig['scanFrequency'] }))}
              >
                <SelectTrigger id="scan-frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">Every 12 hours</SelectItem>
                  <SelectItem value="24h">Every 24 hours</SelectItem>
                  <SelectItem value="48h">Every 48 hours</SelectItem>
                  <SelectItem value="80h">Every 80 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai-api-key">OpenAI API Key</Label>
              <Input
                id="openai-api-key"
                type="input"
                placeholder="Enter your OpenAI API key"
                value={config.openAiApiKey}
                onChange={(e) => setConfig((prevConfig) => ({ ...prevConfig, openAiApiKey: e.target.value }))}
              />
              <p className="text-sm text-gray-500">
                This API key will be used to analyze job listings.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ConfigurationForm;
