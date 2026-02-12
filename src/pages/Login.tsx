
import LoginForm from '@/components/auth/LoginForm';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Job AI Scout</h1>
          <p className="text-gray-600 mt-2">
            Track job listings across multiple companies
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;
