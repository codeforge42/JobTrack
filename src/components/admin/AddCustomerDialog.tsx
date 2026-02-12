import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle } from 'lucide-react';

import { Customer } from '@/types';
import { addCustomer } from '@/services/admin-api';
import { useToast } from '@/hooks/use-toast';

type Props = {
  onCustomerListUpdate: (customers: Customer[]) => void;
};

const CustomerCreateDialog = ({ onCustomerListUpdate }: Props) => {
  const [visible, setVisible] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    homepage: '',
    linkedInUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const submitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName) {
      toast({
        title: 'Name is required',
        description: 'Please enter the customer name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const customers = await addCustomer(
        formData.fullName,
        formData.homepage,
        formData.linkedInUrl
      );

      toast({
        title: 'Success',
        description: `Added "${formData.fullName}" to the customer list.`,
      });

      setFormData({ fullName: '', homepage: '', linkedInUrl: '' });
      setVisible(false);
      onCustomerListUpdate(customers);
    } catch {
      toast({
        title: 'Submission failed',
        description: 'Unable to add customer. Please retry.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={setVisible}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
          <DialogDescription>
            Fill out the information to register a customer for tracking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitCustomer} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              placeholder="e.g. Acme Inc"
              onChange={(e) => updateField('fullName', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="homepage">Website</Label>
            <Input
              id="homepage"
              value={formData.homepage}
              placeholder="e.g. https://company.com"
              onChange={(e) => updateField('homepage', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="linkedInUrl">LinkedIn</Label>
            <Input
              id="linkedInUrl"
              value={formData.linkedInUrl}
              placeholder="e.g. https://linkedin.com/company/company"
              onChange={(e) => updateField('linkedInUrl', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVisible(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerCreateDialog;
