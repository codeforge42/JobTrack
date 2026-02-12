
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Customer } from '@/types';
import { scanPage } from '@/services/admin-api';
import { deleteCustomer, updateCustomer } from '@/services/admin-api';
import { useToast } from '@/hooks/use-toast';
import { Edit, RefreshCw, Trash2 } from 'lucide-react';
import CompanyItem from './CompanyItem';

interface CustomerPanelProps {
  customer: any;
  index: number;
  setCustomers: (customers: any[]) => void;
}

const CustomerPanel = ({ customer, index, setCustomers }: CustomerPanelProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [name, setName] = useState<string>(customer.name);
  const [website, setWebsite] = useState<string>(customer.website);
  const [linkedin, setLinkedin] = useState<string>(customer.linkedin);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleScanAll = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling

    if (isScanning) return;

    try {
      setIsScanning(true);
      toast({
        title: 'Scanning started',
        description: `Scanning all companies for ${customer.name}...`,
      });

      await scanPage(customer.name, '');
      // await refreshCustomers();

      toast({
        title: 'Scanning complete',
        description: `Successfully scanned all companies for ${customer.name}.`,
      });
    } catch (error) {
      toast({
        title: 'Scanning failed',
        description: 'There was an error scanning the companies.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    // Implement customer edit functionality
    toast({
      title: 'Edit Customer',
      description: `Edit functionality would open a modal for ${customer.name}`,
    });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      const data = await deleteCustomer(customer);
      toast({
        title: 'Customer deleted',
        description: `${customer.name} has been successfully removed.`,
      });
      setCustomers(data);
    } catch (error) {
      toast({
        title: 'Deletion failed',
        description: 'There was an error removing the customer.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    navigate(`/admin/customer/${index}/report`);
  };

  return (
    <>
      <Accordion type="single" collapsible defaultValue={index === 0 ? `customer-${customer.name}` : undefined}>
        <AccordionItem value={`customer-${customer.name}`} className="border rounded-lg mb-4 overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 no-svg">
            <div className="flex flex-1 items-center">
              <div className="text-left flex-1">
                <h3
                  className="text-lg font-medium cursor-pointer hover:text-blue-600"
                  onClick={handleNameClick}
                  style={{ width: `${customer.name.length}ch` }} // Dynamically set width based on name length
                >
                  {customer.name}
                </h3>
                <div className="text-sm text-gray-500 flex gap-4 mt-1">
                  <span>{customer.pages.length} Pages</span>
                  {/* <span>Last scan: {formatDate(customer.lastScanDate)}</span> */}
                  <div className="text-left flex-1">
                    {customer.website && (
                      <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-blue-600">
                        {customer.website}
                      </a>
                    )}
                    {customer.linkedin && (
                      <a href={customer.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-blue-600">
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{customer.linkedin}
                      </a>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex gap-2 ml-4" style={{ marginLeft: '-20px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent accordion from toggling
                    setShowEditDialog(true); // Show the Edit dialog
                  }}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="h-9 px-3"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleScanAll}
                  disabled={isScanning}
                  className="h-9 px-3"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Scanning...' : 'Scan All'}
                </Button>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0">
            <div className="border-t">
              <div className="px-6 py-3 bg-gray-50 border-b">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500">
                  <div className="col-span-2">Company</div>
                  <div className="col-span-2">Url</div>
                  <div className="col-span-2">Website/Linkedin</div>
                  <div className="col-span-3">Notes</div>
                  <div className="col-span-2">LastScanDate</div>
                  <div className="col-span-1 text-right">Scan</div>
                </div>
              </div>
              <div className="divide-y">
                {customer.pages.length === 0 ? (
                  <div className="py-4 px-6 text-center text-gray-500">
                    No pages found for this customer.
                  </div>
                ) : (
                  customer.pages.map((urlData: any, key: string) => (
                    <CompanyItem
                      companyName={customer.name}
                      pageLink={urlData.link}
                      lastScanDate={urlData.last_scan_date}
                      pageNotes={urlData.notes}
                    />
                  ))
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer "{customer.name}" and all associated job pages and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Customer Information</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name, website, linkedin for the customer "{customer.name}".
              <div className="py-4">
                <input
                  placeholder="Enter customer name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-12 px-4 mb-4 border border-gray-300 rounded-md"
                />
                <input
                  id="website"
                  placeholder="e.g. https://careers.google.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full h-12 px-4 mb-4 border border-gray-300 rounded-md"
                />
                <input
                  id="linkedin"
                  placeholder="e.g. https://linkedin.com/company/google"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  className="w-full h-12 px-4 mb-4 border border-gray-300 rounded-md"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!name) {
                  toast({
                    title: 'Missing information',
                    description: 'Please fill out name fields.',
                    variant: 'destructive',
                  });
                  return;
                }

                try {
                  setIsUpdating(true);
                  const data = await updateCustomer(name, website, linkedin, customer);
                  setCustomers(data);
                  toast({
                    title: 'Customer added',
                    description: `${name} has been added successfully.`,
                  });

                  // Reset form and close dialog
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: 'Failed to update customer. Please try again.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsUpdating(false);
                }
              }}
              disabled={isUpdating || !name} // Disable if passwords don't match
              className={`bg-blue-600 hover:bg-blue-700 ${isUpdating || !name ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? 'Updating...' : 'Update'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >
    </>
  );
};

export default CustomerPanel;
