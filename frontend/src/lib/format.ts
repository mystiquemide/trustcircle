export const truncateAddress = (address: string, head = 6, tail = 4) => {
  if (!address || address.length < head + tail + 3) {
    return address;
  }

  return `${address.slice(0, head)}...${address.slice(-tail)}`;
};

export const formatCycleDuration = (seconds: number) => {
  if (seconds === 604800) {
    return 'Weekly';
  }

  if (seconds === 1209600) {
    return 'Biweekly';
  }

  if (seconds === 2629746) {
    return 'Monthly';
  }

  const days = Math.floor(seconds / 86400);
  if (days > 0) {
    return `Every ${days} day${days === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(seconds / 3600);
  if (hours > 0) {
    return `Every ${hours}h`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `Every ${minutes}m`;
  }

  return `Every ${seconds}s`;
};

export const formatTimeLeft = (timeLeftSeconds: number) => {
  if (timeLeftSeconds <= 0) {
    return 'Deadline passed';
  }

  const days = Math.floor(timeLeftSeconds / 86400);
  const hours = Math.floor((timeLeftSeconds % 86400) / 3600);
  const minutes = Math.floor((timeLeftSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
};

export const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
