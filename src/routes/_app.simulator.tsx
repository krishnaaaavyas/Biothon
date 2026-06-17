import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  Heart,
  TrendingDown,
  Dumbbell,
  Moon,
  Smoking,
  Coffee,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useProfile, useHealthResult } from "@/lib/health-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auth } from "@/lib/firebase";

export const Route = createFileRoute("/_app/simulator")({
  component: SimulatorPage,
});

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface SimulationComparison {
  diabetes: { current: number; projected: number };
  heart: { current: number; projected: number };
  hypertension: { current: number; projected: number };
}

interface SimulationImpact {
  factor: string;
  contribution: number;
}

function SimulatorPage() {
  useEffect(() => {
    document.title = "What-If Simulator — HealthGuard";
  }, []);

  const navigate = useNavigate();
  const [profile] = useProfile();
  const [result] = useHealthResult();

  // If profile is missing, guide the user to complete the health assessment first
  if (!profile || !result) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center flex flex-col items-center justify-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-teal shadow-card-soft">
          <Activity className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
          Assessment Required
        </h1>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
          Please complete your initial health assessment before opening the What-If Simulator.
        </p>
        <Button
          onClick={() => navigate({ to: "/assessment" })}
          className="mt-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold px-6 py-2 h-11"
        >
          <span>Start Assessment</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Simulation parameters state
  const [simWeight, setSimWeight] = useState<number>(profile.weightKg);
  const [simExercise, setSimExercise] = useState<string>(profile.exercise);
  const [simSmoking, setSimSmoking] = useState<string>(profile.smoking);
  const [simAlcohol, setSimAlcohol] = useState<string>("never");
  const [simSleep, setSimSleep] = useState<number>(8);

  // Result state
  const [loading, setLoading] = useState(false);
  const [projectedRisk, setProjectedRisk] = useState<number | null>(null);
  const [reductionPct, setReductionPct] = useState<number>(0);
  const [healthGain, setHealthGain] = useState<string>("None");
  const [comparison, setComparison] = useState<SimulationComparison | null>(null);
  const [impacts, setImpacts] = useState<SimulationImpact[]>([]);
  const [simExplanation, setSimExplanation] = useState<string>("");
  const [explanationLoading, setExplanationLoading] = useState<boolean>(false);

  // Calculate current overall risk
  const currentOverallRisk = result.overallScore;

  // Run the simulation API call
  const runSimulation = async (
    weight = simWeight,
    exercise = simExercise,
    smoking = simSmoking,
    alcohol = simAlcohol,
    sleep = simSleep
  ) => {
    setLoading(true);
    setSimExplanation("");
    try {
      let idToken = "mock-uid-guest";
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }

      const response = await fetch(`${API_URL}/api/simulator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          modifications: {
            weightKg: weight,
            exercise,
            smoking,
            alcohol,
            sleepHours: sleep,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to calculate simulation");
      }

      const data = await response.json();
      setProjectedRisk(data.projectedRisk);
      setReductionPct(data.reductionPercentage);
      setHealthGain(data.estimatedHealthGain);
      setComparison(data.comparison);
      setImpacts(data.impactAnalysis || []);
      toast.success("Simulation computed successfully");

      // AI Simulation explanation logic
      const changesList: string[] = [];
      if (weight !== profile.weightKg) {
        changesList.push(`Weight changed from ${profile.weightKg}kg to ${weight}kg`);
      }
      if (exercise !== profile.exercise) {
        changesList.push(`Exercise changed from ${profile.exercise} to ${exercise}`);
      }
      if (smoking !== profile.smoking) {
        changesList.push(`Smoking changed from ${profile.smoking} to ${smoking}`);
      }
      if (alcohol !== "never") {
        changesList.push(`Alcohol intake changed to ${alcohol}`);
      }
      if (sleep !== 8) {
        changesList.push(`Sleep changed to ${sleep} hours`);
      }

      if (changesList.length > 0) {
        setExplanationLoading(true);
        try {
          const explainResponse = await fetch(`${API_URL}/api/coach/explain-simulation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              currentRisk: currentOverallRisk,
              projectedRisk: data.projectedRisk,
              changes: changesList,
              language: "en"
            })
          });

          if (explainResponse.ok) {
            const explainData = await explainResponse.json();
            setSimExplanation(explainData.explanation);
          }
        } catch (explainErr) {
          console.error("Failed to fetch simulation explanation:", explainErr);
        } finally {
          setExplanationLoading(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Could not run simulation. Make sure the backend is active.");
    } finally {
      setLoading(false);
    }
  };

  // Run initial simulation on load
  useEffect(() => {
    runSimulation(profile.weightKg, profile.exercise, profile.smoking, "never", 8);
  }, []);

  // Quick preset handlers
  const handleLoseWeight = () => {
    const target = Math.max(30, Math.round(profile.weightKg - 5));
    setSimWeight(target);
    runSimulation(target, simExercise, simSmoking, simAlcohol, simSleep);
  };

  const handleExerciseDaily = () => {
    setSimExercise("moderate");
    runSimulation(simWeight, "moderate", simSmoking, simAlcohol, simSleep);
  };

  const handleQuitSmoking = () => {
    setSimSmoking("never");
    runSimulation(simWeight, simExercise, "never", simAlcohol, simSleep);
  };

  const handleLimitAlcohol = () => {
    setSimAlcohol("never");
    runSimulation(simWeight, simExercise, simSmoking, "never", simSleep);
  };

  const handleOptimizeSleep = () => {
    setSimSleep(8);
    runSimulation(simWeight, simExercise, simSmoking, simAlcohol, 8);
  };

  const currentBmi = Number((profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1));
  const simBmi = Number((simWeight / Math.pow(profile.heightCm / 100, 2)).toFixed(1));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
      {/* Header section with back button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Badge
            variant="secondary"
            className="rounded-full bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
          >
            What-If decision engine
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Health Decision Simulator
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Modify your weight, fitness habits, and sleep parameters below to forecast how small lifestyle adjustments can slash your clinical health risk.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 text-xs border-border hover:bg-accent/40"
        >
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left column: Controls */}
        <div className="space-y-6 lg:col-span-7">
          {/* Quick Scenario Preset Cards */}
          <Card className="border-border bg-surface shadow-card-soft">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider text-[11px] text-teal">
                Quick Simulation Scenarios
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Button
                  onClick={handleLoseWeight}
                  variant="outline"
                  className="h-14 text-xs font-semibold flex flex-col gap-1 items-center justify-center border-border hover:bg-teal/5 hover:border-teal/30 hover:text-teal text-left cursor-pointer"
                  disabled={profile.weightKg <= 50}
                >
                  <TrendingDown className="h-4 w-4 text-teal" />
                  <span>Lose 5 kg</span>
                </Button>
                <Button
                  onClick={handleExerciseDaily}
                  variant="outline"
                  className="h-14 text-xs font-semibold flex flex-col gap-1 items-center justify-center border-border hover:bg-teal/5 hover:border-teal/30 hover:text-teal text-left cursor-pointer"
                  disabled={profile.exercise === "active" || profile.exercise === "moderate"}
                >
                  <Dumbbell className="h-4 w-4 text-teal" />
                  <span>Exercise 30m/day</span>
                </Button>
                <Button
                  onClick={handleQuitSmoking}
                  variant="outline"
                  className="h-14 text-xs font-semibold flex flex-col gap-1 items-center justify-center border-border hover:bg-teal/5 hover:border-teal/30 hover:text-teal text-left cursor-pointer"
                  disabled={profile.smoking === "never"}
                >
                  <Coffee className="h-4 w-4 text-teal" />
                  <span>Quit Smoking</span>
                </Button>
                <Button
                  onClick={handleLimitAlcohol}
                  variant="outline"
                  className="h-14 text-xs font-semibold flex flex-col gap-1 items-center justify-center border-border hover:bg-teal/5 hover:border-teal/30 hover:text-teal text-left cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4 text-teal" />
                  <span>Limit Alcohol</span>
                </Button>
                <Button
                  onClick={handleOptimizeSleep}
                  variant="outline"
                  className="h-14 text-xs font-semibold flex flex-col gap-1 items-center justify-center border-border hover:bg-teal/5 hover:border-teal/30 hover:text-teal text-left cursor-pointer"
                >
                  <Moon className="h-4 w-4 text-teal" />
                  <span>Optimize Sleep</span>
                </Button>
                <Button
                  onClick={() => {
                    setSimWeight(profile.weightKg);
                    setSimExercise(profile.exercise);
                    setSimSmoking(profile.smoking);
                    setSimAlcohol("never");
                    setSimSleep(8);
                    runSimulation(profile.weightKg, profile.exercise, profile.smoking, "never", 8);
                  }}
                  variant="ghost"
                  className="h-14 text-xs font-bold text-muted-foreground hover:text-foreground flex flex-col gap-1 items-center justify-center cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset Variables</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sliders and drop downs */}
          <Card className="border-border bg-surface shadow-card-soft">
            <CardContent className="p-6 space-y-6">
              <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wider text-[11px] text-teal">
                Adjust Changeable Parameters
              </h3>

              {/* Weight Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Target Weight</span>
                  <span className="font-mono text-teal font-bold bg-teal/5 px-2.5 py-0.5 rounded border border-teal/10">
                    {simWeight} kg <span className="text-xs text-muted-foreground font-normal">(BMI: {simBmi})</span>
                  </span>
                </div>
                <Slider
                  min={40}
                  max={160}
                  step={1}
                  value={[simWeight]}
                  onValueChange={(val) => setSimWeight(val[0])}
                  className="[&>span]:bg-teal"
                />
                <p className="text-[10px] text-muted-foreground">
                  Your baseline weight is {profile.weightKg} kg (BMI: {currentBmi}).
                </p>
              </div>

              {/* Sleep Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Sleep Duration</span>
                  <span className="font-mono text-teal font-bold bg-teal/5 px-2.5 py-0.5 rounded border border-teal/10">
                    {simSleep} hrs
                  </span>
                </div>
                <Slider
                  min={4}
                  max={10}
                  step={0.5}
                  value={[simSleep]}
                  onValueChange={(val) => setSimSleep(val[0])}
                  className="[&>span]:bg-teal"
                />
                <p className="text-[10px] text-muted-foreground">
                  Sleeping under 6 hours triggers chronic metabolic and autonomic vascular strain.
                </p>
              </div>

              {/* Selectors Grid */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exercise Frequency</Label>
                  <Select value={simExercise} onValueChange={setSimExercise}>
                    <SelectTrigger className="h-10 border-border/80 bg-surface/50 transition-all duration-200 focus:border-teal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No exercise</SelectItem>
                      <SelectItem value="light">Light (1-2x/week)</SelectItem>
                      <SelectItem value="moderate">Moderate (3-4x/week)</SelectItem>
                      <SelectItem value="active">Active (5+ / week)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Smoking Status</Label>
                  <Select value={simSmoking} onValueChange={setSimSmoking}>
                    <SelectTrigger className="h-10 border-border/80 bg-surface/50 transition-all duration-200 focus:border-teal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never smoked</SelectItem>
                      <SelectItem value="former">Former smoker</SelectItem>
                      <SelectItem value="current">Current smoker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alcohol Habits</Label>
                  <Select value={simAlcohol} onValueChange={setSimAlcohol}>
                    <SelectTrigger className="h-10 border-border/80 bg-surface/50 transition-all duration-200 focus:border-teal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never drink or very rare</SelectItem>
                      <SelectItem value="occasional">Occasional / Social drinking</SelectItem>
                      <SelectItem value="heavy">Frequent / Daily intake</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Trigger Button */}
              <Button
                onClick={() => runSimulation()}
                className="w-full h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all shadow-md mt-4 gap-2 flex items-center justify-center cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Recalculating Risk...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Simulate Lifestyle Projection</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Results */}
        <div className="space-y-6 lg:col-span-5">
          {/* Main Risk Delta Card */}
          <Card className="border-border bg-surface shadow-card-soft overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal via-primary to-accent" />
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-bold">Overall Risk Delta</CardTitle>
              <CardDescription>Estimated aggregate chronic risk drop comparison.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Giant compared scores */}
              <div className="flex items-center justify-around py-4 border-b border-border/40 pb-6">
                <div className="text-center">
                  <div className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">Current</div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-foreground mt-1">{currentOverallRisk}%</div>
                </div>
                <div className="text-2xl text-muted-foreground font-light">→</div>
                <div className="text-center">
                  <div className="text-xs font-bold font-mono text-teal uppercase tracking-wider">Projected</div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-teal mt-1">
                    {projectedRisk !== null ? `${projectedRisk}%` : "--"}
                  </div>
                </div>
              </div>

              {/* Metrics badges */}
              {projectedRisk !== null && (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-teal/5 p-3 rounded-lg border border-teal/10 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Risk Reduced</span>
                    <span className="text-lg font-bold text-teal mt-1">{reductionPct}%</span>
                  </div>
                  <div className="bg-teal/5 p-3 rounded-lg border border-teal/10 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Health Gain</span>
                    <span className="text-sm font-extrabold text-teal mt-1.5 uppercase tracking-wider">{healthGain}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Condition level breakdown */}
          <Card className="border-border bg-surface shadow-card-soft">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Condition Level Projections</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {comparison ? (
                <>
                  {/* Diabetes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">Type 2 Diabetes Risk</span>
                      <span className="text-muted-foreground font-mono">
                        {comparison.diabetes.current}% → <span className="text-teal font-bold">{comparison.diabetes.projected}%</span>
                      </span>
                    </div>
                    <ProgressComparison current={comparison.diabetes.current} projected={comparison.diabetes.projected} />
                  </div>

                  {/* Heart Disease */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">Cardiovascular Risk</span>
                      <span className="text-muted-foreground font-mono">
                        {comparison.heart.current}% → <span className="text-teal font-bold">{comparison.heart.projected}%</span>
                      </span>
                    </div>
                    <ProgressComparison current={comparison.heart.current} projected={comparison.heart.projected} />
                  </div>

                  {/* Hypertension */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">Hypertension Risk</span>
                      <span className="text-muted-foreground font-mono">
                        {comparison.hypertension.current}% → <span className="text-teal font-bold">{comparison.hypertension.projected}%</span>
                      </span>
                    </div>
                    <ProgressComparison current={comparison.hypertension.current} projected={comparison.hypertension.projected} />
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Awaiting simulation values...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Impact Explanations */}
          {impacts.length > 0 && (
            <Card className="border-border bg-surface shadow-card-soft">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Impact Explanation Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {impacts.map((imp, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-border/40 pb-2.5 last:border-0 last:pb-0 text-sm">
                      <span className="font-semibold text-foreground">{imp.factor}</span>
                      <Badge
                        variant="secondary"
                        className={`font-mono text-xs font-bold ${imp.contribution < 0 ? "bg-teal/10 text-teal border border-teal/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}
                      >
                        {imp.contribution > 0 ? `+${imp.contribution}%` : `${imp.contribution}%`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Simulator Insights */}
          {(explanationLoading || simExplanation) && (
            <Card className="border-border bg-surface shadow-card-soft overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal via-primary to-accent" />
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal animate-pulse" /> AI Coach Simulator Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2">
                {explanationLoading ? (
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground py-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal" />
                    <span>AI Coach is analyzing your lifestyle modifications...</span>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-xs text-foreground leading-relaxed">
                    <ReactMarkdown>{simExplanation}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Disclaimers */}
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-accent/40 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
            <p className="text-[10px] leading-relaxed text-accent-foreground">
              What-If simulator parameters estimate lifestyle correlations from chronic guideline metrics. Calculations are for educational forecasts and do not represent guaranteed physiological drop predictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressComparison({ current, projected }: { current: number; projected: number }) {
  // Relative placement for comparisons
  return (
    <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
      {/* Current/original risk as background light color */}
      <div
        className="absolute top-0 bottom-0 left-0 bg-red-500/25 rounded-full"
        style={{ width: `${current}%` }}
      />
      {/* Projected risk overlaying it in solid color */}
      <div
        className="absolute top-0 bottom-0 left-0 bg-teal rounded-full transition-all duration-500"
        style={{ width: `${projected}%` }}
      />
    </div>
  );
}
