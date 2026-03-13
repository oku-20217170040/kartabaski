import AnimatedLoadingSkeleton from '@/components/ui/animated-loading-skeleton'
import Navbar from '@/components/Navbar'

export default function Loading() {
  return (
    <>
      <Navbar />
      <main className="products-page">
        <div className="container">
          <AnimatedLoadingSkeleton />
        </div>
      </main>
    </>
  )
}
