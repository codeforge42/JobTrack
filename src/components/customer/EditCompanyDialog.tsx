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
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { updateCompany } from '@/services/custonmers-companies-api';
import { Company } from '@/types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface EditCompanyDialogProps {
  open: boolean;
  onClose: () => void;
  company: Company;
  setCompany: React.Dispatch<React.SetStateAction<Company>>;
  userId: string;
}

const formSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().optional(),
  selector: z.string().optional(),
  linkedin: z.string().optional(),
  notes: z.string().optional(),
  period: z.string()
})
  .refine(
    (data) => data.website || data.linkedin, // Ensure at least one is provided
    {
      message: 'At least one of Website or LinkedIn is required',
      path: ['website'],
    }
  );

type FormValues = z.infer<typeof formSchema>;

const EditCompanyDialog = ({ open, onClose, company, setCompany, userId }: EditCompanyDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: company.name,
      website: company.website,
      selector: company.selector,
      linkedin: company.linkedin,
      notes: company.notes,
      period: company.period ? company.period : '48h'
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);

      const data = await updateCompany(userId, company.id, {
        name: values.name,
        website: values.website,
        selector: values.selector,
        linkedin: values.linkedin,
        notes: values.notes || '',
        period: values.period || '48h'
      });

      setCompany(data);

      toast({
        title: 'Success',
        description: 'Company updated successfully.',
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update company.',
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
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription>
            Update the company information.
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
                    <Input {...field} />
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
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-y w-full" placeholder="e.g. https://careers.google.com" />
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
                    <Textarea {...field} className="resize-y w-full" placeholder="e.g. #jobs-list" />
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
                    <Textarea {...field} className="resize-y w-full" placeholder="e.g. https://www.linkedin.com/jobs/search?keywords=Google&location=Worldwide&geoId=92000000&trk=public_jobs_jobs-search-bar_search-submit&position=1&pageNum=0" />
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
                    <Textarea {...field} placeholder="Add any notes here..." />
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
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCompanyDialog;
