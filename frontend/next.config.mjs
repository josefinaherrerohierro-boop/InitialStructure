/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Para probar la app desde otros dispositivos con los túneles de VS Code.
  allowedDevOrigins: ['*.devtunnels.ms'],
}

export default nextConfig