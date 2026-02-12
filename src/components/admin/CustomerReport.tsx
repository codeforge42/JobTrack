
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getCustomerById } from '@/services/admin-api';
import { Job } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const CustomerReport = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        if (!customerId) {
          throw new Error('Customer ID is required');
        }

        const numericCustomerId = parseInt(customerId, 10); // Convert customerId to a number
        if (isNaN(numericCustomerId)) {
          throw new Error('Invalid Customer ID');
        }

        const response = await getCustomerById(numericCustomerId);

        const customerData = response;

        // Safely access jobs and other properties
        let allJobs: Job[] = [];
        for (const page of customerData.pages) {
          if (page.jobs) {
            allJobs.push(...page.jobs);
          }
        }
        setJobs(allJobs);
        setCustomer(customerData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load customer data.',
          variant: 'destructive',
        });
        navigate('/admin/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId, navigate, toast]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No customer data found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">{customer.name || 'Unknown Customer'}</h2>
          <p className="text-sm text-gray-500 mt-1">{customer.website || 'No website available'}</p>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Job Pages</h3>
              <p className="mt-1 text-lg font-semibold">{customer.pages ? customer.pages.length : 0}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Jobs</h3>
              <p className="mt-1 text-lg font-semibold">{jobs.length}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <h3 className="text-xl font-semibold mb-4">Job Listings</h3>

          {jobs.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              No job listings found for this customer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AI Analysis
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job: Job) => {
                    if (job.description.includes('Yes,')) {
                      return (
                        <tr
                          key={job.id}
                          className={cn(
                            "hover:bg-gray-50 transition-colors",
                            job.description.includes("Yes,") ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500"
                          )}
                          style={{ borderLeft: job.description.includes("Yes,") ? "4px solid #34D399" : "4px solid #F87171" }}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div
                              className={cn(
                                "font-medium",
                                job.description.includes("Yes,") ? "tech-position" : "non-tech-position"
                              )}
                            >
                              {job.title}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                            {customer.name || 'Unknown Company'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 max-w-md truncate">
                            {job.description}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <a
                              href={job.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                            >
                              View Job
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    }
                  }
                  )}
                  {jobs.map((job: Job) => {
                    if (!job.description.includes('Yes,')) {
                      return (
                        <tr
                          key={job.id}
                          className={cn(
                            "hover:bg-gray-50 transition-colors",
                            job.description.includes("Yes,") ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500"
                          )}
                          style={{ borderLeft: job.description.includes("Yes,") ? "4px solid #34D399" : "4px solid #F87171" }}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div
                              className={cn(
                                "font-medium",
                                job.description.includes("Yes,") ? "tech-position" : "non-tech-position"
                              )}
                            >
                              {job.title}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                            {customer.name || 'Unknown Company'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 max-w-md truncate">
                            {job.description}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <a
                              href={job.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                            >
                              View Job
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    }
                  }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerReport;
