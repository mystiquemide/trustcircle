import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '../components/common';

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center">
      <Card className="max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
          <ExclamationTriangleIcon className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-[color:var(--text-primary)]">404</h1>
        <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">Page not found</p>
        <p className="mt-2 text-sm text-muted">
          The page you requested does not exist. Return to your TrustCircle home.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/home">
            <Button>Go Home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
