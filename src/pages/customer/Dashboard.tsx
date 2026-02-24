import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getCompanies, deleteCompany, scanCompany, deleteAllRecords, analyzeJobLinksExport } from '../../services/custonmers-companies-api';
import { Company } from '@/types';
import { Plus, Search, RefreshCw } from 'lucide-react';
import CompanyCard from '@/components/customer/CompanyCard';
import AddCompanyDialog from '@/components/customer/AddCompanyDialog';
import { useAuth } from '@/contexts/AuthContext';

const CustomerDashboard = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [currentlyScanningCompanyId, setCurrentlyScanningCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanTypes, setScanTypes] = useState<{ website: boolean; linkedin: boolean }>({
    website: true,
    linkedin: false,
  });
  const [analyzingLinks, setAnalyzingLinks] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const analyzeJobLinks = async () => {
    try {
      setAnalyzingLinks(true);
      const blob = await analyzeJobLinksExport(user.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JobLinks-analyzed-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Export ready',
        description: 'Job links analyzed and Excel file downloaded.',
      });
    } catch (error: unknown) {
      console.error('Analyze job links error:', error);
      let message = 'Failed to analyze job links. Ensure JobLinks.xlsx exists in backend/output.';
      if (error && typeof error === 'object' && 'response' in error) {
        const res = (error as { response: { data?: Blob | { message?: string }; status?: number } }).response;
        if (res.data && typeof res.data === 'object' && res.data !== null && 'message' in res.data) {
          message = (res.data as { message: string }).message;
        } else if (res.data instanceof Blob) {
          try {
            const text = await (res.data as Blob).text();
            const parsed = JSON.parse(text);
            if (parsed?.message) message = parsed.message;
          } catch {
            // keep default message
          }
        }
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAnalyzingLinks(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('user')) fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      if (localStorage.getItem('user')) {
        const data = await getCompanies(JSON.parse(localStorage.getItem('user') || '{}')['user'].id);
        setCompanies(data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load companies.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
      const data = await deleteCompany(user.id, companyId);
      setCompanies(data);
      toast({
        title: 'Company deleted',
        description: 'The company has been successfully deleted.',
      });
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete company.',
        variant: 'destructive',
      });
    }
  };

  const handleScanAll = async (e: React.MouseEvent) => {
    e.stopPropagation();

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

    // Check if there are companies to scan
    if (companies.length === 0) {
      toast({
        title: 'No companies to scan',
        description: 'There are no companies available to scan.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsScanning(true);
      toast({
        title: 'Scanning started',
        description: `Scanning ${companies.length} companies for ${user.name}...`,
      });

      const selectedTypes = [];
      if (scanTypes.website) selectedTypes.push('website');
      if (scanTypes.linkedin) selectedTypes.push('linkedin');

      // Scan each company one by one
      const updatedCompanies = [...companies];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        try {
          // Set the currently scanning company ID to show scanning state in CompanyCard
          setCurrentlyScanningCompanyId(company.id);
          
          const scannedCompanyStr = await scanCompany(user.id, company.id, selectedTypes);
          const scannedCompany = JSON.parse(scannedCompanyStr);
          
          // Update the company in the array
          const companyIndex = updatedCompanies.findIndex(c => c.id === company.id);
          if (companyIndex !== -1) {
            updatedCompanies[companyIndex] = scannedCompany;
            // Update state immediately so UI reflects the change
            setCompanies([...updatedCompanies]);
          }
          successCount++;
        } catch (error) {
          console.error(`Error scanning company ${company.name}:`, error);
          failCount++;
        } finally {
          // Clear the currently scanning company ID
          setCurrentlyScanningCompanyId(null);
        }
      }

      if (failCount === 0) {
        toast({
          title: 'Scanning complete',
          description: `Successfully scanned ${successCount} companies for ${user.name}.`,
        });
      } else {
        toast({
          title: 'Scanning completed with errors',
          description: `Scanned ${successCount} companies successfully, ${failCount} failed.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error during scan all:', error);
      toast({
        title: 'Scanning failed',
        description: 'There was an error scanning the companies.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
      setCurrentlyScanningCompanyId(null);
    }
  };
  const handleDeleteAllRecords = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await deleteAllRecords(user.id);
      toast({
        title: 'All records deleted',
        description: 'All records have been successfully deleted.',
      });
    } catch (error) {
      console.error('Error deleting all records:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete all records.',
        variant: 'destructive',
      });
    }
  };

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.website.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.linkedin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-4 items-center">
         
          {/* <div className="flex items-center gap-3 px-3 py-2 border rounded-md">
            <Label className="text-sm font-medium">Scan Types:</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scan-website"
                  checked={scanTypes.website}
                  onCheckedChange={(checked) =>
                    setScanTypes((prev) => ({ ...prev, website: checked as boolean }))
                  }
                />
                <Label htmlFor="scan-website" className="text-sm font-normal cursor-pointer">
                  Website
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scan-linkedin"
                  checked={scanTypes.linkedin}
                  onCheckedChange={(checked) =>
                    setScanTypes((prev) => ({ ...prev, linkedin: checked as boolean }))
                  }
                />
                <Label htmlFor="scan-linkedin" className="text-sm font-normal cursor-pointer">
                  LinkedIn
                </Label>
              </div>
            </div>
          </div> */}
          
          <Button
            variant="default"
            onClick={handleScanAll}
            disabled={isScanning}
            className="flex items-center gap-2 h-9 px-4"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : `Scan All`}
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 h-9 px-4"
          >
            <Plus className="h-4 w-4" />
            Customer
          </Button>
          <Button
            variant="default"
            onClick={handleDeleteAllRecords}
            className="flex items-center gap-2 h-9 px-4"
          >
            Delete All Records
          </Button>
          <Button
            variant="default"
            onClick={analyzeJobLinks}
            disabled={analyzingLinks}
            className="flex items-center gap-2 h-9 px-4"
          >
            {analyzingLinks ? 'Analyzing...' : 'Analyze Job Links'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search companies..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">Loading...</div>
        </div>
      ) : filteredCompanies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              userId={user.id}
              company={company}
              setCompanies={setCompanies}
              onDelete={handleDeleteCompany}
              isExternalScanning={currentlyScanningCompanyId === company.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium text-gray-700">No companies found</h3>
          <p className="text-gray-500 mt-1">Add your first company to start tracking job listings.</p>
        </div>
      )}

      <AddCompanyDialog
        open={dialogOpen}
        setCompanies={setCompanies}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
};

export default CustomerDashboard;
