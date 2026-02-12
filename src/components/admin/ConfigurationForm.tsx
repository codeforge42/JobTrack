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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getScanConfig,
  updateScanConfig,
  changePassword,
} from '@/services/admin-api';
import { ScanConfig } from '@/types';
import { useToast } from '@/hooks/use-toast';

const ConfigurationForm = () => {
  const [config, setConfig] = useState<ScanConfig>({
    scanFrequency: '24h',
    openAiApiKey: '',
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const data = await getScanConfig();
        if (Array.isArray(data) && data.length >= 2) {
          setConfig({
            scanFrequency: ['12h', '24h', '48h', '80h'].includes(data[0])
              ? (data[0] as ScanConfig['scanFrequency'])
              : '24h',
            openAiApiKey: data[1],
          });
        } else {
          throw new Error('Invalid data');
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Could not fetch configuration.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [toast]);

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateScanConfig(config);
      toast({
        title: 'Saved',
        description: 'Configuration updated successfully.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Mismatch',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword('admin@evgeny.com', currentPassword, newPassword);
      toast({
        title: 'Success',
        description: 'Password changed.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({
        title: 'Error',
        description: 'Password change failed.',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="animate-pulse">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>Set scan frequency and OpenAI key.</CardDescription>
        </CardHeader>
        <form onSubmit={saveConfig}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scan-frequency">Scan Frequency</Label>
              <Select
                value={config.scanFrequency}
                onValueChange={(val) =>
                  setConfig({ ...config, scanFrequency: val as ScanConfig['scanFrequency'] })
                }
              >
                <SelectTrigger id="scan-frequency">
                  <SelectValue placeholder="Frequency" />
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
                value={config.openAiApiKey}
                onChange={(e) =>
                  setConfig({ ...config, openAiApiKey: e.target.value })
                }
                placeholder="sk-..."
              />
              <p className="text-sm text-muted-foreground">
                Used for job content analysis.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update admin credentials.</CardDescription>
        </CardHeader>
        <form onSubmit={updatePassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ConfigurationForm;
