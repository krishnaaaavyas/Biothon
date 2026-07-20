import type { Profile } from "./health-store";

export type MacroTarget = {
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  fiber: number;   // in grams
};

export function calculateCalorieAndMacros(profile: Profile): MacroTarget {
  const weight = profile.weightKg || 70;
  const height = profile.heightCm || 170;
  const age = profile.age || 30;
  const gender = profile.gender || "male";

  // Mifflin-St Jeor Equation
  let bmr = 0;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // Activity Factor multiplier
  let activityMultiplier = 1.2;
  const act = profile.exercise || "none";
  if (act === "light") activityMultiplier = 1.375;
  else if (act === "moderate") activityMultiplier = 1.55;
  else if (act === "active") activityMultiplier = 1.725;

  let tdee = bmr * activityMultiplier;

  // Occupation offset
  const occ = (profile.occupation || "").toLowerCase();
  if (occ === "labour") {
    tdee += 300;
  } else if (occ === "office" || occ === "student") {
    tdee -= 100;
  } else if (occ === "healthcare") {
    tdee += 100;
  }

  // Goal adjustment
  const goal = profile.weightGoal || "maintain";
  let targetCalories = tdee;
  if (goal === "lose") {
    targetCalories -= 400;
    // Safeguard caps
    const minCap = gender === "male" ? 1500 : 1200;
    if (targetCalories < minCap) {
      targetCalories = minCap;
    }
  } else if (goal === "gain") {
    targetCalories += 300;
  }

  targetCalories = Math.round(targetCalories);

  // Protein calculation
  const fitGoal = (profile.fitnessGoal || "").toLowerCase();
  const hasDiabetes = (profile.medicalConditions || []).includes("diabetes");
  
  let proteinPerKg = 1.0;
  if (fitGoal.includes("muscle") || goal === "gain") {
    proteinPerKg = 1.8;
  } else if (fitGoal.includes("weight") || goal === "lose" || hasDiabetes) {
    proteinPerKg = 1.4;
  }

  let protein = Math.round(weight * proteinPerKg);
  if (protein < 45) protein = 45; // safe baseline

  // Fat calculation: 25% of calories
  let fat = Math.round((targetCalories * 0.25) / 9);
  if (fat < 30) fat = 30; // safe baseline

  // Carbs calculation: remaining calories
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  let carbKcal = targetCalories - (proteinKcal + fatKcal);
  if (carbKcal < 400) {
    carbKcal = 400;
  }
  let carbs = Math.round(carbKcal / 4);

  // Fiber target
  const fiber = gender === "female" ? 25 : 35;

  return {
    calories: targetCalories,
    protein,
    carbs,
    fat,
    fiber
  };
}

export type MealItem = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  course: "breakfast" | "lunch" | "snacks" | "dinner";
  cuisines: string[]; // e.g. ["north", "south", "gujarati", "punjabi", "maharashtrian", "bengali", "central"]
  types: string[]; // e.g. ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"]
  contains: string[]; // ingredients to test for exclusions: ["paneer", "milk", "eggs", "fish", "chicken", "soy", "peanuts", "gluten", "onion", "garlic"]
  explanation: string;
};

// Extensive Indian Meal Catalog (Phase 1 library)
export const INDIAN_MEALS_CATALOG: MealItem[] = [
  // --- BREAKFAST ---
  {
    name: "Vegetable Poha",
    calories: 250, protein: 6, carbs: 45, fat: 5,
    course: "breakfast",
    cuisines: ["west", "gujarati", "maharashtrian", "central"],
    types: ["vegetarian", "vegan"],
    contains: ["onion", "gluten"],
    explanation: "Poha is flattened rice flakes, light on the stomach and rich in iron and carbohydrates."
  },
  {
    name: "Oats Upma",
    calories: 220, protein: 7, carbs: 36, fat: 4,
    course: "breakfast",
    cuisines: ["south", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: ["gluten"],
    explanation: "Oats provide high soluble fiber which helps control glycemic response and cholesterol levels."
  },
  {
    name: "Moong Dal Chilla",
    calories: 240, protein: 12, carbs: 32, fat: 6,
    course: "breakfast",
    cuisines: ["north", "punjabi", "gujarati", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Moong dal is a high-protein, low glycemic index legume that supports muscle repair and blood sugar balance."
  },
  {
    name: "Ragi Dosa with Coconut Chutney",
    calories: 280, protein: 6, carbs: 50, fat: 6,
    course: "breakfast",
    cuisines: ["south"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Ragi is exceptionally high in calcium and fiber, making it excellent for bone health and diabetic nutrition."
  },
  {
    name: "Steamed Idli with Sambar",
    calories: 210, protein: 6, carbs: 40, fat: 2,
    course: "breakfast",
    cuisines: ["south"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: ["onion"],
    explanation: "Fermented idli is easy to digest and prebiotic-friendly, supporting gut health."
  },
  {
    name: "Paneer Bhurji with Multigrain Roti",
    calories: 320, protein: 18, carbs: 30, fat: 12,
    course: "breakfast",
    cuisines: ["north", "punjabi", "central"],
    types: ["vegetarian"],
    contains: ["paneer", "milk", "onion", "garlic", "gluten"],
    explanation: "Paneer is rich in casein protein and calcium, keeping you satiated for hours."
  },
  {
    name: "Egg White Omelette with Spinach",
    calories: 180, protein: 16, carbs: 4, fat: 10,
    course: "breakfast",
    cuisines: ["north", "south", "central", "bengali"],
    types: ["eggetarian", "non-vegetarian"],
    contains: ["eggs", "onion"],
    explanation: "Egg whites provide pure, fast-absorbing albumin protein with minimal carbohydrates."
  },
  {
    name: "Sprouts Chaat",
    calories: 190, protein: 10, carbs: 32, fat: 2,
    course: "breakfast",
    cuisines: ["gujarati", "maharashtrian", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Sprouted pulses are packed with living enzymes, Vitamin C, and plant-based protein."
  },
  {
    name: "Besan Chilla",
    calories: 230, protein: 10, carbs: 35, fat: 5,
    course: "breakfast",
    cuisines: ["north", "gujarati", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Besan (chickpea flour) is naturally gluten-free and contains a healthy ratio of protein to fiber."
  },

  // --- LUNCH ---
  {
    name: "Dal Tadka with Brown Rice and Salad",
    calories: 410, protein: 14, carbs: 70, fat: 8,
    course: "lunch",
    cuisines: ["north", "punjabi", "gujarati", "central"],
    types: ["vegetarian", "vegan"],
    contains: ["onion", "garlic"],
    explanation: "Lentils paired with brown rice form a complete protein profile containing all essential amino acids."
  },
  {
    name: "Gujarati Kadhi with Khichdi",
    calories: 380, protein: 10, carbs: 68, fat: 7,
    course: "lunch",
    cuisines: ["gujarati"],
    types: ["vegetarian", "satvik", "jain", "no-onion-garlic"],
    contains: ["milk"],
    explanation: "Khichdi is a soothing, easy-to-digest comfort food that cleanses the digestive tract."
  },
  {
    name: "Sambhar Sadam with Cabbage Poriyal",
    calories: 390, protein: 9, carbs: 72, fat: 6,
    course: "lunch",
    cuisines: ["south"],
    types: ["vegetarian", "vegan"],
    contains: ["onion"],
    explanation: "Cabbage provides rich amounts of vitamin K and sulfur-compounds that support cellular health."
  },
  {
    name: "Methi Thepla with Curd and Roasted Papad",
    calories: 340, protein: 12, carbs: 54, fat: 8,
    course: "lunch",
    cuisines: ["gujarati"],
    types: ["vegetarian", "satvik", "jain", "no-onion-garlic"],
    contains: ["milk", "gluten"],
    explanation: "Fenugreek (methi) leaves help regulate insulin sensitivity and reduce metabolic inflammation."
  },
  {
    name: "Bhindi Masala with 2 Phulka and Curd",
    calories: 360, protein: 12, carbs: 56, fat: 9,
    course: "lunch",
    cuisines: ["north", "punjabi", "maharashtrian", "central"],
    types: ["vegetarian"],
    contains: ["milk", "onion", "gluten"],
    explanation: "Bhindi (okra) contains soluble mucilage fibers that bind to cholesterol in the digestive tract."
  },
  {
    name: "Bengali Macher Jhol with White Rice",
    calories: 450, protein: 26, carbs: 65, fat: 10,
    course: "lunch",
    cuisines: ["bengali"],
    types: ["non-vegetarian"],
    contains: ["fish", "onion", "garlic"],
    explanation: "Rohu fish contains omega-3 fatty acids that improve heart health and reduce triglyceride markers."
  },
  {
    name: "Paneer Tikka Masala with 2 Bajra Roti",
    calories: 460, protein: 20, carbs: 52, fat: 18,
    course: "lunch",
    cuisines: ["north", "punjabi", "central"],
    types: ["vegetarian"],
    contains: ["paneer", "milk", "onion", "garlic", "gluten"],
    explanation: "Bajra (pearl millet) is a gluten-free grain loaded with magnesium, vital for cardiovascular relaxation."
  },
  {
    name: "Soya Chunks Curry with Brown Rice",
    calories: 400, protein: 22, carbs: 62, fat: 7,
    course: "lunch",
    cuisines: ["north", "bengali", "central"],
    types: ["vegetarian", "vegan"],
    contains: ["soy", "onion", "garlic"],
    explanation: "Soya chunks are an exceptional source of complete plant protein, matching meat amino profiles."
  },

  // --- SNACKS ---
  {
    name: "Roasted Makhana (Lotus Seeds)",
    calories: 120, protein: 3, carbs: 24, fat: 2,
    course: "snacks",
    cuisines: ["north", "punjabi", "gujarati", "maharashtrian", "bengali", "south", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Makhanas are low-calorie, low-glycemic snacks loaded with antioxidants and anti-inflammatory agents."
  },
  {
    name: "Dhokla (Steamed Khaman)",
    calories: 150, protein: 5, carbs: 26, fat: 3,
    course: "snacks",
    cuisines: ["gujarati"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: ["gluten"],
    explanation: "Steamed fermented chickpea batter is highly bioavailable and keeps digestive health robust."
  },
  {
    name: "Boiled Chickpea Salad",
    calories: 160, protein: 8, carbs: 26, fat: 2,
    course: "snacks",
    cuisines: ["north", "south", "gujarati", "maharashtrian", "bengali", "punjabi", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Chickpeas contain dietary fibers that encourage slow digestion and steady insulin control."
  },
  {
    name: "Roasted Chana (Bengal Gram)",
    calories: 140, protein: 7, carbs: 22, fat: 2,
    course: "snacks",
    cuisines: ["north", "gujarati", "maharashtrian", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Roasted gram is a portable, high-fiber snack that helps stabilize blood glucose between meals."
  },
  {
    name: "Mixed Nuts (Almonds and Walnuts)",
    calories: 180, protein: 5, carbs: 6, fat: 16,
    course: "snacks",
    cuisines: ["north", "punjabi", "gujarati", "maharashtrian", "bengali", "south", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: ["peanuts"],
    explanation: "Almonds and walnuts are rich in Vitamin E, omega-3s, and monounsaturated fats that support brain and vascular health."
  },

  // --- DINNER ---
  {
    name: "Moong Dal Khichdi with Roasted Papad",
    calories: 320, protein: 11, carbs: 58, fat: 5,
    course: "dinner",
    cuisines: ["gujarati", "maharashtrian", "north", "central"],
    types: ["vegetarian", "satvik", "jain", "no-onion-garlic"],
    contains: ["milk"],
    explanation: "A simple meal that is extremely light on the liver and digestive system before bedtime."
  },
  {
    name: "Paneer Bhurji with 2 Jowar Rotis",
    calories: 390, protein: 22, carbs: 48, fat: 12,
    course: "dinner",
    cuisines: ["north", "punjabi", "maharashtrian", "central"],
    types: ["vegetarian"],
    contains: ["paneer", "milk", "onion", "garlic"],
    explanation: "Jowar (sorghum) is a complex carbohydrate that releases glucose slowly, preventing midnight crashes."
  },
  {
    name: "Tandoori Chicken with Cucumber Mint Raita",
    calories: 360, protein: 32, carbs: 8, fat: 22,
    course: "dinner",
    cuisines: ["north", "punjabi", "central"],
    types: ["non-vegetarian"],
    contains: ["chicken", "milk", "onion", "garlic"],
    explanation: "Tandoori grilling locks in high protein while shedding excess saturated fats, supporting lean muscle mass."
  },
  {
    name: "Bengali Fish Curry (Jhol) with 2 Atta Roti",
    calories: 410, protein: 24, carbs: 56, fat: 9,
    course: "dinner",
    cuisines: ["bengali"],
    types: ["non-vegetarian"],
    contains: ["fish", "onion", "garlic", "gluten"],
    explanation: "Light fish gravy provides healthy amino building blocks without stress on your lipid markers."
  },
  {
    name: "Yellow Dal Fry with 2 Multigrain Roti and Bhindi",
    calories: 380, protein: 14, carbs: 62, fat: 8,
    course: "dinner",
    cuisines: ["north", "punjabi", "gujarati", "maharashtrian", "central"],
    types: ["vegetarian", "vegan"],
    contains: ["onion", "garlic", "gluten"],
    explanation: "A complete home-cooked balance of grains, soluble fiber, and plant-based protein."
  },
  {
    name: "Mix Vegetable Sabzi with 2 Ragi Roti",
    calories: 340, protein: 9, carbs: 60, fat: 7,
    course: "dinner",
    cuisines: ["south", "maharashtrian", "gujarati", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    explanation: "Ragi rotis paired with high fiber green vegetables supply calcium and trace essential minerals."
  },
  {
    name: "Tofu Stir-fry with Broccoli and Quinoa",
    calories: 350, protein: 16, carbs: 48, fat: 10,
    course: "dinner",
    cuisines: ["north", "south", "central"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: ["soy"],
    explanation: "Tofu is a rich vegan source of iron, calcium, and all 9 essential amino acids."
  }
];

export type ExerciseItem = {
  name: string;
  sets: string;
  explanation: string;
  focus: string; // Cardio, Strength, Intervals, Mobility, Rest
  locations: string[]; // ["home", "gym", "outdoor"]
  equipment: string[]; // ["none", "bands", "dumbbells", "gym"]
  avoidIfInjury: string[]; // e.g. ["knee-pain", "back-pain", "arthritis"]
};

// Exercise Library
export const EXERCISES_LIBRARY: ExerciseItem[] = [
  // Cardio
  {
    name: "Brisk Walking / LISS",
    sets: "30-45 mins steady",
    explanation: "Walking improves cardiovascular circulation while remaining completely safe for knees and joints.",
    focus: "Cardio",
    locations: ["home", "gym", "outdoor"],
    equipment: ["none"],
    avoidIfInjury: []
  },
  {
    name: "Low-Impact Cycling",
    sets: "25-30 mins moderate pace",
    explanation: "Aerobic cycling strengthens quadriceps without high mechanical strain on patellar joints.",
    focus: "Cardio",
    locations: ["gym"],
    equipment: ["gym"],
    avoidIfInjury: []
  },
  {
    name: "Jump Squats / High-Impact Cardio",
    sets: "3 sets of 45s work / 15s rest",
    explanation: "Highly intense cardio that triggers explosive speed but exerts high mechanical stress.",
    focus: "Cardio",
    locations: ["home", "gym", "outdoor"],
    equipment: ["none"],
    avoidIfInjury: ["knee-pain", "back-pain", "arthritis"]
  },

  // Strength
  {
    name: "Bodyweight Glute Bridges",
    sets: "3 sets of 15 reps",
    explanation: "Activates posterior chain muscles without loaded spinal or knee compression.",
    focus: "Strength",
    locations: ["home", "gym", "outdoor"],
    equipment: ["none"],
    avoidIfInjury: []
  },
  {
    name: "Supported Chair Squats",
    sets: "3 sets of 12 reps",
    explanation: "Strengthens knee stabilizers safely using a chair for guided balance.",
    focus: "Strength",
    locations: ["home", "gym"],
    equipment: ["none"],
    avoidIfInjury: []
  },
  {
    name: "Dumbbell Goblet Squats",
    sets: "4 sets of 8-10 reps",
    explanation: "Improves leg power and builds muscle mass; keep core braced to protect your spine.",
    focus: "Strength",
    locations: ["gym", "home"],
    equipment: ["dumbbells", "gym"],
    avoidIfInjury: ["knee-pain", "back-pain"]
  },
  {
    name: "Resistance Band Chest Press",
    sets: "3 sets of 12 reps",
    explanation: "Strengthens pectorals and shoulders using bands, putting less torque on rotator cuffs.",
    focus: "Strength",
    locations: ["home", "gym"],
    equipment: ["bands"],
    avoidIfInjury: []
  },
  {
    name: "Barbell Bench Press",
    sets: "4 sets of 8 reps",
    explanation: "Compounded upper body movement to stimulate chest, triceps, and anterior deltoids.",
    focus: "Strength",
    locations: ["gym"],
    equipment: ["gym"],
    avoidIfInjury: []
  },
  {
    name: "Dumbbell Shoulder Press",
    sets: "3 sets of 10 reps",
    explanation: "Builds deltoids and upper trap strength. Avoid loaded overhead movements if experiencing acute back pain.",
    focus: "Strength",
    locations: ["gym", "home"],
    equipment: ["dumbbells", "gym"],
    avoidIfInjury: ["back-pain"]
  },
  {
    name: "Resistance Band Lat Pulldown",
    sets: "3 sets of 15 reps",
    explanation: "Engages latissimus dorsi, correcting upper back posture and supporting spine alignment.",
    focus: "Strength",
    locations: ["home", "gym"],
    equipment: ["bands"],
    avoidIfInjury: []
  },

  // Mobility
  {
    name: "Gentle Cat-Cow Stretch",
    sets: "2 sets of 10 flow cycles",
    explanation: "Mobilizes lumbar, thoracic spine, and pelvis, releasing lower back tension.",
    focus: "Mobility",
    locations: ["home", "gym", "outdoor"],
    equipment: ["none"],
    avoidIfInjury: []
  },
  {
    name: "Hamstring and Calf Stretch",
    sets: "3 holding sets of 30s per leg",
    explanation: "Stretching calves and hamstrings takes pressure off the knee cap and lower back.",
    focus: "Mobility",
    locations: ["home", "gym", "outdoor"],
    equipment: ["none"],
    avoidIfInjury: []
  },
  {
    name: "Gentle Hatha Yoga Flow",
    sets: "20-30 mins flow",
    explanation: "Maintains flexibility, joint fluid health, and lowers cortisol stress markers.",
    focus: "Mobility",
    locations: ["home", "gym", "outdoor"],
    equipment: ["none"],
    avoidIfInjury: []
  }
];

export type MealPlan = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  explanation: string;
};

export type DailyMealSchedule = {
  breakfast: MealPlan;
  lunch: MealPlan;
  snacks: MealPlan;
  dinner: MealPlan;
};

export type WeeklyDietSchedule = Record<string, DailyMealSchedule>;

export type ExercisePlan = {
  name: string;
  sets: string;
  explanation: string;
};

export type DailyWorkoutSchedule = {
  focus: string;
  min: number;
  exercises: ExercisePlan[];
};

export type WeeklyWorkoutSchedule = Record<string, DailyWorkoutSchedule>;

export function generatePersonalizedPlans(profile: Profile): {
  dietPlan: WeeklyDietSchedule;
  workoutPlan: WeeklyWorkoutSchedule;
  macroTarget: MacroTarget;
} {
  const macros = calculateCalorieAndMacros(profile);

  // 1. GENERATE DIET PLAN
  const weeklyDiet: WeeklyDietSchedule = {};
  const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  // Filter Catalog
  const filterMeals = (course: MealItem["course"]) => {
    return INDIAN_MEALS_CATALOG.filter((m) => {
      if (m.course !== course) return false;

      // 1. Check basic diet preference type
      const pref = profile.dietType || "vegetarian";
      if (pref === "vegetarian" || pref === "satvik" || pref === "jain" || pref === "no-onion-garlic") {
        if (m.types.includes("non-vegetarian") || m.types.includes("eggetarian")) return false;
      }
      if (pref === "vegan" && !m.types.includes("vegan")) return false;
      if (pref === "eggetarian" && m.types.includes("non-vegetarian")) return false;

      // Jain / Satvik/ No onion garlic filters
      if (pref === "jain" && !m.types.includes("jain")) return false;
      if (pref === "satvik" && !m.types.includes("satvik")) return false;
      if (pref === "no-onion-garlic" && !m.types.includes("no-onion-garlic") && !m.types.includes("jain") && !m.types.includes("satvik")) {
        if (m.contains.includes("onion") || m.contains.includes("garlic")) return false;
      }

      // 2. Excluded Foods Checklist
      const excluded = profile.excludedFoods || [];
      for (const item of excluded) {
        if (m.contains.includes(item)) return false;
      }

      // 3. Lactose intolerance
      if (profile.lactoseIntolerant && (m.contains.includes("milk") || m.contains.includes("paneer"))) {
        return false;
      }

      return true;
    });
  };

  const bMeals = filterMeals("breakfast");
  const lMeals = filterMeals("lunch");
  const sMeals = filterMeals("snacks");
  const dMeals = filterMeals("dinner");

  // Fallbacks in case filter leaves empty list
  const getFallbackMeal = (course: MealItem["course"]): MealItem => {
    const rawList = INDIAN_MEALS_CATALOG.filter((m) => m.course === course);
    return rawList[0];
  };

  weekdays.forEach((day, index) => {
    // Pick meal items in a round-robin rotation to keep meals varied
    const bItem = bMeals.length > 0 ? bMeals[index % bMeals.length] : getFallbackMeal("breakfast");
    const lItem = lMeals.length > 0 ? lMeals[index % lMeals.length] : getFallbackMeal("lunch");
    const sItem = sMeals.length > 0 ? sMeals[index % sMeals.length] : getFallbackMeal("snacks");
    const dItem = dMeals.length > 0 ? dMeals[index % dMeals.length] : getFallbackMeal("dinner");

    weeklyDiet[day] = {
      breakfast: {
        name: bItem.name,
        calories: bItem.calories,
        protein: bItem.protein,
        carbs: bItem.carbs,
        fat: bItem.fat,
        explanation: bItem.explanation
      },
      lunch: {
        name: lItem.name,
        calories: lItem.calories,
        protein: lItem.protein,
        carbs: lItem.carbs,
        fat: lItem.fat,
        explanation: lItem.explanation
      },
      snacks: {
        name: sItem.name,
        calories: sItem.calories,
        protein: sItem.protein,
        carbs: sItem.carbs,
        fat: sItem.fat,
        explanation: sItem.explanation
      },
      dinner: {
        name: dItem.name,
        calories: dItem.calories,
        protein: dItem.protein,
        carbs: dItem.carbs,
        fat: dItem.fat,
        explanation: dItem.explanation
      }
    };
  });

  // 2. GENERATE WORKOUT PLAN
  const weeklyWorkout: WeeklyWorkoutSchedule = {};
  const isBeginner = profile.fitnessLevel === "beginner";
  const isSenior = (profile.age || 30) > 55;
  const injuries = profile.medicalConditions || [];
  const location = profile.exerciseLocation || "home";
  const equip = profile.equipment || "none";

  // Filter Exercises
  const filterExercises = (focus: string) => {
    return EXERCISES_LIBRARY.filter((ex) => {
      if (ex.focus !== focus) return false;

      // Location match
      if (!ex.locations.includes(location)) return false;

      // Equipment match
      if (equip === "none") {
        if (!ex.equipment.includes("none")) return false;
      } else if (equip === "bands") {
        if (ex.equipment.includes("dumbbells") || ex.equipment.includes("gym")) return false;
      } else if (equip === "dumbbells") {
        if (ex.equipment.includes("gym")) return false;
      }

      // Injury match
      for (const injury of injuries) {
        if (ex.avoidIfInjury.includes(injury)) return false;
      }

      return true;
    });
  };

  const cardioExs = filterExercises("Cardio");
  const strengthExs = filterExercises("Strength");
  const mobilityExs = filterExercises("Mobility");

  const getFallbackExercise = (focus: string): ExerciseItem => {
    const raw = EXERCISES_LIBRARY.filter((e) => e.focus === focus);
    return raw[0];
  };

  // Routine structures based on fitnessLevel
  // Beginner: 3 active days (Mon, Wed, Fri), others Rest/Mobility
  // Intermediate: 5 active days
  // Advanced: 6 active days
  const level = profile.fitnessLevel || "beginner";

  weekdays.forEach((day, index) => {
    let focus = "Rest";
    let min = 20;
    let list: ExerciseItem[] = [];

    if (level === "beginner") {
      if (day === "mon") {
        focus = "Cardio";
        min = isSenior ? 20 : 30;
        const e = cardioExs[0] || getFallbackExercise("Cardio");
        list = [e];
      } else if (day === "wed") {
        focus = "Strength";
        min = 25;
        const e = strengthExs[0] || getFallbackExercise("Strength");
        list = [e];
      } else if (day === "fri") {
        focus = "Cardio";
        min = isSenior ? 20 : 30;
        const e = cardioExs[1] || cardioExs[0] || getFallbackExercise("Cardio");
        list = [e];
      } else if (day === "sat") {
        focus = "Mobility";
        min = 20;
        const e = mobilityExs[0] || getFallbackExercise("Mobility");
        list = [e];
      } else {
        focus = "Rest";
        min = 15;
      }
    } else if (level === "intermediate") {
      if (day === "mon" || day === "thu") {
        focus = "Strength";
        min = 40;
        list = strengthExs.slice(0, 2);
        if (list.length === 0) list = [getFallbackExercise("Strength")];
      } else if (day === "tue" || day === "fri") {
        focus = "Cardio";
        min = 35;
        list = cardioExs.slice(0, 1);
        if (list.length === 0) list = [getFallbackExercise("Cardio")];
      } else if (day === "sat") {
        focus = "Mobility";
        min = 30;
        list = mobilityExs.slice(0, 2);
        if (list.length === 0) list = [getFallbackExercise("Mobility")];
      } else {
        focus = "Rest";
        min = 20;
      }
    } else {
      // Advanced
      if (day === "mon" || day === "wed" || day === "fri") {
        focus = "Strength";
        min = 50;
        list = strengthExs.slice(0, 3);
        if (list.length === 0) list = [getFallbackExercise("Strength")];
      } else if (day === "tue" || day === "thu") {
        focus = "Cardio";
        min = 45;
        list = cardioExs.slice(0, 2);
        if (list.length === 0) list = [getFallbackExercise("Cardio")];
      } else if (day === "sat") {
        focus = "Mobility";
        min = 30;
        list = mobilityExs.slice(0, 2);
        if (list.length === 0) list = [getFallbackExercise("Mobility")];
      } else {
        focus = "Rest";
        min = 25;
      }
    }

    // Map sets for beginners vs advanced
    const exercises: ExercisePlan[] = list.map((item) => {
      let sets = item.sets;
      if (isBeginner && sets.includes("sets")) {
        sets = sets.replace("4 sets", "2 sets").replace("3 sets", "2 sets");
      }
      return {
        name: item.name,
        sets,
        explanation: item.explanation
      };
    });

    // Handle complete rest day
    if (focus === "Rest" && exercises.length === 0) {
      exercises.push({
        name: "Full Rest / Light Recovery Walk",
        sets: "15-20 mins easy pace",
        explanation: "Rest gives muscles time to rebuild and prevents inflammatory joint strain."
      });
    }

    weeklyWorkout[day] = {
      focus,
      min,
      exercises
    };
  });

  return {
    dietPlan: weeklyDiet,
    workoutPlan: weeklyWorkout,
    macroTarget: macros
  };
}
