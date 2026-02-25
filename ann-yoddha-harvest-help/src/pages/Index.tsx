import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Search, Sprout, Leaf, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Upload",
    description: "Snap or upload a photo of your wheat crop leaf for instant analysis.",
  },
  {
    icon: Search,
    title: "Diagnose",
    description: "Our AI model detects diseases like rust, blight, and Karnal bunt in seconds.",
  },
  {
    icon: Sprout,
    title: "Treat",
    description: "Get tailored treatment recommendations — chemical, organic, and preventive.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="font-display text-xl font-bold text-primary">Ann Yoddha</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container pb-16 pt-12 md:pb-24 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sprout className="h-4 w-4" />
              AI-Powered Precision Agriculture
            </div>
            <h1 className="mb-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
              Detect Wheat Diseases{" "}
              <span className="text-gradient-primary">Instantly</span>
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
              Upload a photo of your crop, get an AI diagnosis in seconds, and receive expert treatment recommendations — right from the field.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/signup">
                <Button size="lg" className="gap-2 text-base">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-base">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-20">
        <motion.div
          className="grid gap-6 md:grid-cols-3"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={item}>
              <Card className="h-full border-primary/10 bg-card transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-4 rounded-xl bg-primary/10 p-3">
                    <f.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold">{f.title}</h3>
                  <p className="text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ann Yoddha. Empowering farmers with AI.
        </div>
      </footer>
    </div>
  );
};

export default Index;
