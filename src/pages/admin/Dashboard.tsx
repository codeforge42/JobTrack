
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { getAdmin } from '@/services/admin-api';
import { Customer } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import CustomerPanel from '@/components/admin/CustomerPanel';
import AddCustomerDialog from '@/components/admin/AddCustomerDialog';

const Dashboard = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await getAdmin();
      setCustomers(data.companies);
      setFilteredCustomers(data.companies);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load customers.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [toast]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.website.toLowerCase().includes(query) ||
          customer.linkedin.toLowerCase().includes(query) ||
          customer.pages.some((url : any) => url.link.toLowerCase().includes(query))
      );
      setFilteredCustomers(filtered);
    }
  }, [searchQuery, customers]);

  // const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setSearchQuery(e.target.value);
  // };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Customer Dashboard</h1>
        <div className="flex w-full sm:w-auto gap-4">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoComplete="off" // Prevent autofill
            />
          </div>
          <AddCustomerDialog onCustomerListUpdate={setCustomers} />
        </div>
      </div>

      {loading? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">Loading...</div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-lg shadow py-12 px-6 text-center">
          <h3 className="text-lg font-medium text-gray-700 mb-2"> No Customer found</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'Try a different search term or clear your search.' : 'Start by adding your first customer.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCustomers && filteredCustomers.map((customer, index) => (
            <CustomerPanel
              key={customer.id}
              customer={customer}
              index={index}
              setCustomers={setCustomers}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
