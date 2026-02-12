import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { scanPage } from '@/services/admin-api';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

type Props = {
  companyName: string;
  pageLink: string;
  lastScanDate: Date;
  pageNotes: string;
};

const CompanyRow = ({ companyName, pageLink, lastScanDate, pageNotes }: Props) => {
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const extractHost = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Invalid URL';
    }
  };

  const initiateScan = async () => {
    if (scanning) return;

    setScanning(true);
    toast({
      title: 'Initiating scan',
      description: `Looking for job listings at ${companyName}`,
    });

    try {
      await scanPage(companyName, pageLink);

      toast({
        title: 'Scan complete',
        description: `Finished scanning ${companyName}.`,
      });
    } catch {
      toast({
        title: 'Scan error',
        description: 'Something went wrong during the scan.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const isLinkedIn = pageLink.includes('linkedin');

  return (
    <div className="grid grid-cols-12 items-center gap-4 px-6 py-3 text-sm">
      <div className="col-span-2 font-semibold">{companyName}</div>

      <div className="col-span-2 truncate">
        <a
          href={pageLink || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {extractHost(pageLink)}
        </a>
      </div>

      <div className="col-span-2 text-muted-foreground">
        {isLinkedIn ? 'LinkedIn' : 'Website'}
      </div>

      <div className="col-span-3 text-gray-600 truncate">
        {pageNotes || '—'}
      </div>

      <div className="col-span-2 text-gray-600">
        {lastScanDate ? new Date(lastScanDate).toLocaleString() : 'Not Scanned'}
      </div>

      <div className="col-span-1 flex justify-end">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={initiateScan}
          disabled={scanning}
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};

export default CompanyRow;
