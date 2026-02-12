import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createCompany } from '@/services/custonmers-companies-api';
import { useAuth } from '@/contexts/AuthContext';

interface Company {
  id: string;
  name: string;
  website?: string;
  linkedin?: string;
  notes?: string;
  period: string;
  // Add other fields as needed
}

interface AddCompanyDialogProps {
  open: boolean;
  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  onClose: () => void;
}

const formSchema = z
  .object({
    name: z.string().min(1, 'Company name is required'),
    website: z.string().optional(),
    selector: z.string().optional(),
    linkedin: z.string().optional(),
    notes: z.string().optional(),
    period: z.string(),
  })
  .refine(
    (data) => data.website || data.linkedin,
    {
      message: 'At least one of Website or LinkedIn is required',
      path: ['website'],
    }
  );

type FormValues = z.infer<typeof formSchema>;

const AddCompanyDialog = ({ open, setCompanies, onClose }: AddCompanyDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      website: '',
      selector: '',
      linkedin: '',
      notes: '',
      period: '48h',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add a company.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await createCompany(
        user.id,
        values.name,
        values.website,
        values.selector,
        values.linkedin,
        values.notes || '',
        values.period || '48h'
      );
      setCompanies(data);
      toast({
        title: 'Success',
        description: 'Company added successfully.',
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error('Error adding company:', error);
      toast({
        title: 'Error',
        description: 'Failed to add company.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Add a new page url and selector to track job postings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Google" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Url</FormLabel>
                  <FormControl>
                    <Input placeholder="https://careers.google.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="selector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selector</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. div.job-posting" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* <FormField
              control={form.control}
              name="linkedin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn</FormLabel>
                  <FormControl>
                    <Input placeholder="https://linkedin.com/company/google" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any notes about this company" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 48h" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Company'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCompanyDialog;
