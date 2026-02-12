import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getCustomerById } from "@/services/customers-api";
import { deleteRecords } from '../../services/custonmers-companies-api';
import { Company, Job } from "@/types";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const CompanyJobs = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceType, setSourceType] = useState<"website" | "linkedin">("website");
  const { user } = useAuth();

  // Filter jobs by source type
  const getFilteredJobs = (type: "website" | "linkedin") => {
    return jobs.filter((job) => {
      const isLinkedIn = job.link?.toLowerCase().includes("linkedin.com");
      return type === "linkedin" ? isLinkedIn : !isLinkedIn;
    });
  };

  // Count jobs by source
  const websiteJobsCount = useMemo(() => 
    jobs.filter((job) => !job.link?.toLowerCase().includes("linkedin.com")).length,
    [jobs]
  );
  
  const linkedinJobsCount = useMemo(() => 
    jobs.filter((job) => job.link?.toLowerCase().includes("linkedin.com")).length,
    [jobs]
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!companyId) return;

      try {
        setLoading(true);
        const customerId = user?.id;
        // Fetch company details
        const data = await getCustomerById(customerId);
        const companies = data["companies"];
        const foundCompany = companies.find((c) => c.id === companyId);

        if (!foundCompany) {
          toast({
            title: "Error",
            description: "Company not found.",
            variant: "destructive",
          });
          navigate("/customer/dashboard");
          return;
        }

        setCompany(foundCompany);

        // Fetch jobs for this company
        const jobData = foundCompany.jobs;
        setJobs(jobData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load jobs.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, navigate, toast]);

  
    const handleDeleteRecords = async () => {
      if (!user || !company) return;
      
      try {
        await deleteRecords(user.id, company.id, sourceType);
        // Update jobs state to remove deleted jobs
        const filteredJobs = jobs.filter((job) => {
          const isLinkedIn = job.link?.toLowerCase().includes("linkedin.com");
          if (sourceType === "linkedin") {
            // Keep website jobs, remove LinkedIn jobs
            return !isLinkedIn;
          } else {
            // Keep LinkedIn jobs, remove website jobs
            return isLinkedIn;
          }
        });
        setJobs(filteredJobs);
        toast({
          title: 'Success',
          description: `${sourceType === 'linkedin' ? 'LinkedIn' : 'Website'} records deleted successfully.`,
        });
      } catch (error) {
        toast({
          title: 'deletion failed',
          description: 'There was an error deleting the records.',
          variant: 'destructive',
        });
      } 
    };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  // Render job table rows
  const renderJobRows = (jobsToRender: Job[]) => {
    const yesJobs = jobsToRender.filter((job) => job.description.includes("Yes,"));
    const noJobs = jobsToRender.filter((job) => !job.description.includes("Yes,"));

    return (
      <>
        {yesJobs.map((job) => (
          <TableRow
            key={job.id}
            className="border-l-4 border-l-emerald-500"
            style={{ borderLeftWidth: "4px" }}
          >
            <TableCell className="font-medium">{job.title}</TableCell>
            <TableCell className="max-w-md truncate">{job.description}</TableCell>
            <TableCell>
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                View Job
                <ExternalLink className="h-3 w-3" />
              </a>
            </TableCell>
          </TableRow>
        ))}
        {noJobs.map((job) => (
          <TableRow
            key={job.id}
            className="border-l-4 border-l-red-500"
            style={{ borderLeftWidth: "4px" }}
          >
            <TableCell className="font-medium">{job.title}</TableCell>
            <TableCell className="max-w-md truncate">{job.description}</TableCell>
            <TableCell>
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                View Job
                <ExternalLink className="h-3 w-3" />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => navigate("/customer/dashboard")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">{company.name}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">Website:</span>{" "}
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {company.website}
              </a>
            </div>
            <div>
              <span className="font-medium">Last Scan:</span>{" "}
              {company.last_scan_date
                ? new Date(company.last_scan_date).toLocaleString()
                : "Not Scanned"}
            </div>
            <div>
              <span className="font-medium">Total Jobs:</span> {jobs.length} 
              <span className="ml-4 text-gray-500">
                Website: {websiteJobsCount}
                {/* (Website: {websiteJobsCount}, LinkedIn: {linkedinJobsCount}) */}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Job Listings</h3>
            <Button
              variant="default"
              onClick={handleDeleteRecords}
              className="flex items-center gap-2 h-9 px-4"
            >
              Delete Records
            </Button>
          </div>

          <Tabs value={sourceType} onValueChange={(value) => setSourceType(value as "website" | "linkedin")} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="website">
                Website ({websiteJobsCount})
              </TabsTrigger>
              {/* <TabsTrigger value="linkedin">
                LinkedIn ({linkedinJobsCount})
              </TabsTrigger> */}
            </TabsList>

            <TabsContent value="website" className="mt-0">
              {(() => {
                const websiteJobs = getFilteredJobs("website");
                return websiteJobs.length === 0 ? (
                  <div className="text-center py-10 border rounded-lg">
                    <h3 className="text-lg font-medium text-gray-700">
                      No website job listings found
                    </h3>
                    <p className="text-gray-500 mt-1">
                      There are no website job listings available for this company yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {renderJobRows(websiteJobs)}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="linkedin" className="mt-0">
              {(() => {
                const linkedinJobs = getFilteredJobs("linkedin");
                return linkedinJobs.length === 0 ? (
                  <div className="text-center py-10 border rounded-lg">
                    <h3 className="text-lg font-medium text-gray-700">
                      No LinkedIn job listings found
                    </h3>
                    <p className="text-gray-500 mt-1">
                      There are no LinkedIn job listings available for this company yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {renderJobRows(linkedinJobs)}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default CompanyJobs;
