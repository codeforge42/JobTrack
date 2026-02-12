import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { scanCompany } from '@/services/custonmers-companies-api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Company } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Edit, Trash2, RefreshCw } from 'lucide-react';
import EditCompanyDialog from './EditCompanyDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CompanyCardProps {
  userId: string;
  company: Company;
  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  onDelete: (id: string) => Promise<void>;
  isExternalScanning?: boolean;
}

const CompanyCard = ({ userId, company, setCompanies, onDelete, isExternalScanning = false }: CompanyCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentCompany, setCurrentCompany] = useState(company);
  const [scanTypes, setScanTypes] = useState<{ website: boolean; linkedin: boolean }>({
    website: true,
    linkedin: true,
  });

  // Sync external scanning state with internal state
  useEffect(() => {
    setIsScanning(isExternalScanning);
  }, [isExternalScanning]);

  // Count jobs by source
  const websiteJobsCount = useMemo(() => 
    currentCompany.jobs.filter((job) => !job.link?.toLowerCase().includes("linkedin.com")).length,
    [currentCompany.jobs]
  );
  
  const linkedinJobsCount = useMemo(() => 
    currentCompany.jobs.filter((job) => job.link?.toLowerCase().includes("linkedin.com")).length,
    [currentCompany.jobs]
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return typeof date === 'string' ? new Date(date).toLocaleString() : date.toLocaleString();
  };

  const formatUrl = (url: string) => {
    try {
      if (!url) return '';
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      console.error('Invalid URL', e);
      return url;
    }
  };

  const handleScan = async () => {
    if (isScanning) return;

    // Check if at least one scan type is selected
    if (!scanTypes.website && !scanTypes.linkedin) {
      toast({
        title: 'No scan type selected',
        description: 'Please select at least one scan type (Website or LinkedIn).',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsScanning(true);
      toast({
        title: 'Scanning started',
        description: `Scanning jobs for ${currentCompany.name}...`,
      });
      
      const selectedTypes = [];
      if (scanTypes.website) selectedTypes.push('website');
      if (scanTypes.linkedin) selectedTypes.push('linkedin');
      
      const scannedCompany = await scanCompany(userId, currentCompany.id, selectedTypes);
      setCurrentCompany(JSON.parse(scannedCompany));

      toast({
        title: 'Scanning complete',
        description: `Successfully scanned jobs for ${currentCompany.name}.`,
      });
    } catch (error) {
      toast({
        title: 'Scanning failed',
        description: 'There was an error scanning for jobs.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleViewJobs = () => {
    navigate(`/customer/company/${currentCompany.id}/jobs`);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{currentCompany.name}</CardTitle>
            <CardDescription className="text-xs">
              Last scan: {formatDate(currentCompany.last_scan_date)}
            </CardDescription>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleScan}
              disabled={isScanning}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {currentCompany.name} and all of its job listings. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(currentCompany.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Checkbox
                id={`scan-website-${currentCompany.id}`}
                checked={scanTypes.website}
                onCheckedChange={(checked) =>
                  setScanTypes((prev) => ({ ...prev, website: checked as boolean }))
                }
              />
              <p className="text-gray-500 font-medium text-xs">Job Page ({websiteJobsCount})</p>
            </div>
            <a
              href={currentCompany.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
            >
              {formatUrl(currentCompany.website)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {/* <div>
            <div className="flex items-center gap-2 mb-1">
              <Checkbox
                id={`scan-linkedin-${currentCompany.id}`}
                checked={scanTypes.linkedin}
                onCheckedChange={(checked) =>
                  setScanTypes((prev) => ({ ...prev, linkedin: checked as boolean }))
                }
              />
              <p className="text-gray-500 font-medium text-xs">LinkedIn ({linkedinJobsCount})</p>
            </div>
            <a
              href={currentCompany.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
            >
              {formatUrl(currentCompany.linkedin)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div> */}
        </div>

        {/* <div className="mt-2">
          <p className="text-gray-500 font-medium text-xs">Notes</p>
          <p className="text-xs text-gray-700">{currentCompany.notes || 'No Notes'}</p>
        </div> */}

        {/* <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{currentCompany.jobs.length || 0} Jobs</span>
          </div>
        </div> */}
      </CardContent>
      <CardFooter className="pt-2 pb-3">
        <Button variant="outline" onClick={handleViewJobs} size="sm" className="text-xs w-full">
          View Jobs
        </Button>
      </CardFooter>

      <EditCompanyDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        userId={userId}
        setCompany={setCurrentCompany}
        company={currentCompany}
      />
    </Card>
  );
};

export default CompanyCard;
