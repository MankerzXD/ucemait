/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: '/TV',
        destination: '/tv',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
