import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'bn';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.foodDoctor': 'Food Doctor',
    'nav.tracker': 'Daily Tracker',
    'nav.analytics': 'Analytics',
    'nav.exercise': 'Exercise',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'nav.profile': 'Profile',
    
    // Auth
    'auth.login': 'Login',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.fullName': 'Full Name',
    'auth.forgotPassword': 'Forgot Password?',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.loginSuccess': 'Successfully logged in!',
    'auth.signupSuccess': 'Account created successfully!',
    'auth.logoutSuccess': 'Successfully logged out!',
    'auth.welcome': 'Welcome to Desi Nutri',
    'auth.tagline': 'Your personal nutrition companion',
    'auth.devLogin': 'Dev Demo',
    
    // Home
    'home.greeting': 'Hello',
    'home.todaySummary': "Today's Summary",
    'home.calories': 'Calories',
    'home.protein': 'Protein',
    'home.carbs': 'Carbs',
    'home.fat': 'Fat',
    'home.water': 'Water',
    'home.quickActions': 'Quick Actions',
    'home.logMeal': 'Log Meal',
    'home.logExercise': 'Log Exercise',
    'home.logWater': 'Log Water',
    'home.viewAnalytics': 'View Analytics',
    'home.recentActivity': 'Recent Activity',
    'home.noActivity': 'No recent activity. Start tracking!',
    'home.dailyTip': 'Daily Food Tip',
    
    // Daily Tracker
    'tracker.title': 'Daily Tracker',
    'tracker.breakfast': 'Breakfast',
    'tracker.lunch': 'Lunch',
    'tracker.dinner': 'Dinner',
    'tracker.snacks': 'Snacks',
    'tracker.addFood': 'Add Food',
    'tracker.waterIntake': 'Water Intake',
    'tracker.addWater': 'Add Water',
    'tracker.glasses': 'glasses',
    'tracker.ml': 'ml',
    'tracker.goal': 'Goal',
    'tracker.remaining': 'Remaining',
    
    // Food Doctor
    'foodDoctor.title': 'Food Doctor',
    'foodDoctor.subtitle': 'Get personalized nutrition advice',
    'foodDoctor.askQuestion': 'Ask a question...',
    'foodDoctor.suggestions': 'Suggestions based on your profile',
    'foodDoctor.disclaimer': 'This is AI-generated advice. Consult a healthcare professional for medical decisions.',
    'foodDoctor.mealPlan': 'Daily Meal Plan',
    'foodDoctor.recommended': 'Recommended Foods',
    'foodDoctor.budget': 'Budget-Friendly Foods',
    'foodDoctor.avoid': 'Foods to Avoid',
    
    // Analytics
    'analytics.title': 'Analytics',
    'analytics.weekly': 'Weekly',
    'analytics.monthly': 'Monthly',
    'analytics.caloriesTrend': 'Calories Trend',
    'analytics.macroBreakdown': 'Macro Breakdown',
    'analytics.progress': 'Your Progress',
    'analytics.streaks': 'Streaks',
    'analytics.daysTracked': 'Days Tracked',
    
    // Exercise
    'exercise.title': 'Exercise',
    'exercise.logWorkout': 'Log Workout',
    'exercise.workoutType': 'Workout Type',
    'exercise.duration': 'Duration',
    'exercise.minutes': 'minutes',
    'exercise.caloriesBurned': 'Calories Burned',
    'exercise.intensity': 'Intensity',
    'exercise.low': 'Low',
    'exercise.medium': 'Medium',
    'exercise.high': 'High',
    'exercise.history': 'Workout History',
    'exercise.cardio': 'Cardio',
    'exercise.strength': 'Strength',
    'exercise.flexibility': 'Flexibility',
    'exercise.sports': 'Sports',
    'exercise.workoutPlan': "Today's Workout Plan",
    'exercise.todaysTip': "Today's Tip",
    'exercise.missedYesterday': 'Missed from Yesterday',
    'exercise.progress': 'Progress',
    'exercise.allComplete': 'Amazing! All workouts completed today!',
    'exercise.noPlan': 'No workout plan available',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.notifications': 'Notifications',
    'settings.editProfile': 'Edit Profile',
    'settings.about': 'About',
    'settings.help': 'Help & Support',
    'settings.privacy': 'Privacy Policy',
    'settings.deleteAccount': 'Delete Account',
    
    // Profile
    'profile.title': 'Profile',
    'profile.basicInfo': 'Basic Information',
    'profile.healthInfo': 'Health Information',
    'profile.goals': 'Fitness Goals',
    'profile.preferences': 'Food Preferences',
    'profile.age': 'Age',
    'profile.height': 'Height',
    'profile.weight': 'Weight',
    'profile.gender': 'Gender',
    'profile.male': 'Male',
    'profile.female': 'Female',
    'profile.other': 'Other',
    'profile.healthConditions': 'Health Conditions',
    'profile.dietaryRestrictions': 'Dietary Restrictions',
    'profile.allergies': 'Allergies',
    'profile.fitnessGoal': 'Fitness Goal',
    'profile.weightLoss': 'Weight Loss',
    'profile.weightGain': 'Weight Gain',
    'profile.maintenance': 'Maintenance',
    'profile.muscleGain': 'Muscle Gain',
    'profile.dislikedFoods': 'Disliked Foods',
    'profile.saveChanges': 'Save Changes',
    'profile.saved': 'Profile saved successfully!',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.success': 'Success!',
    'common.today': 'Today',
    'common.yesterday': 'Yesterday',
    'common.thisWeek': 'This Week',
    'common.thisMonth': 'This Month',
    'common.kcal': 'kcal',
    'common.g': 'g',
    'common.cm': 'cm',
    'common.kg': 'kg',
    'common.years': 'years',
    'common.min': 'min',
    'common.refresh': 'Refresh',
  },
  bn: {
    // Navigation
    'nav.home': 'হোম',
    'nav.foodDoctor': 'ফুড ডক্টর',
    'nav.tracker': 'দৈনিক ট্র্যাকার',
    'nav.analytics': 'বিশ্লেষণ',
    'nav.exercise': 'ব্যায়াম',
    'nav.settings': 'সেটিংস',
    'nav.logout': 'লগ আউট',
    'nav.profile': 'প্রোফাইল',
    
    // Auth
    'auth.login': 'লগইন',
    'auth.signup': 'সাইন আপ',
    'auth.email': 'ইমেইল',
    'auth.password': 'পাসওয়ার্ড',
    'auth.confirmPassword': 'পাসওয়ার্ড নিশ্চিত করুন',
    'auth.fullName': 'পুরো নাম',
    'auth.forgotPassword': 'পাসওয়ার্ড ভুলে গেছেন?',
    'auth.noAccount': 'অ্যাকাউন্ট নেই?',
    'auth.hasAccount': 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
    'auth.loginSuccess': 'সফলভাবে লগইন হয়েছে!',
    'auth.signupSuccess': 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!',
    'auth.logoutSuccess': 'সফলভাবে লগ আউট হয়েছে!',
    'auth.welcome': 'দেশি নিউট্রিতে স্বাগতম',
    'auth.tagline': 'আপনার ব্যক্তিগত পুষ্টি সহায়ক',
    'auth.devLogin': 'ডেভ ডেমো',
    
    // Home
    'home.greeting': 'হ্যালো',
    'home.todaySummary': 'আজকের সারসংক্ষেপ',
    'home.calories': 'ক্যালোরি',
    'home.protein': 'প্রোটিন',
    'home.carbs': 'কার্বস',
    'home.fat': 'ফ্যাট',
    'home.water': 'পানি',
    'home.quickActions': 'দ্রুত কাজ',
    'home.logMeal': 'খাবার যোগ করুন',
    'home.logExercise': 'ব্যায়াম যোগ করুন',
    'home.logWater': 'পানি যোগ করুন',
    'home.viewAnalytics': 'বিশ্লেষণ দেখুন',
    'home.recentActivity': 'সাম্প্রতিক কার্যকলাপ',
    'home.noActivity': 'কোন সাম্প্রতিক কার্যকলাপ নেই। ট্র্যাকিং শুরু করুন!',
    'home.dailyTip': 'দৈনিক খাদ্য টিপ',
    
    // Daily Tracker
    'tracker.title': 'দৈনিক ট্র্যাকার',
    'tracker.breakfast': 'সকালের নাস্তা',
    'tracker.lunch': 'দুপুরের খাবার',
    'tracker.dinner': 'রাতের খাবার',
    'tracker.snacks': 'স্ন্যাকস',
    'tracker.addFood': 'খাবার যোগ করুন',
    'tracker.waterIntake': 'পানি গ্রহণ',
    'tracker.addWater': 'পানি যোগ করুন',
    'tracker.glasses': 'গ্লাস',
    'tracker.ml': 'মিলি',
    'tracker.goal': 'লক্ষ্য',
    'tracker.remaining': 'বাকি',
    
    // Food Doctor
    'foodDoctor.title': 'ফুড ডক্টর',
    'foodDoctor.subtitle': 'ব্যক্তিগত পুষ্টি পরামর্শ নিন',
    'foodDoctor.askQuestion': 'একটি প্রশ্ন জিজ্ঞাসা করুন...',
    'foodDoctor.suggestions': 'আপনার প্রোফাইলের উপর ভিত্তি করে পরামর্শ',
    'foodDoctor.disclaimer': 'এটি AI-জেনারেটেড পরামর্শ। চিকিৎসা সিদ্ধান্তের জন্য স্বাস্থ্যসেবা পেশাদারের পরামর্শ নিন।',
    'foodDoctor.mealPlan': 'দৈনিক খাদ্য তালিকা',
    'foodDoctor.recommended': 'প্রস্তাবিত খাবার',
    'foodDoctor.budget': 'সাশ্রয়ী খাবার',
    'foodDoctor.avoid': 'এড়িয়ে চলুন',
    
    // Analytics
    'analytics.title': 'বিশ্লেষণ',
    'analytics.weekly': 'সাপ্তাহিক',
    'analytics.monthly': 'মাসিক',
    'analytics.caloriesTrend': 'ক্যালোরি প্রবণতা',
    'analytics.macroBreakdown': 'ম্যাক্রো বিভাজন',
    'analytics.progress': 'আপনার অগ্রগতি',
    'analytics.streaks': 'স্ট্রিক',
    'analytics.daysTracked': 'ট্র্যাক করা দিন',
    
    // Exercise
    'exercise.title': 'ব্যায়াম',
    'exercise.logWorkout': 'ওয়ার্কআউট যোগ করুন',
    'exercise.workoutType': 'ওয়ার্কআউটের ধরন',
    'exercise.duration': 'সময়কাল',
    'exercise.minutes': 'মিনিট',
    'exercise.caloriesBurned': 'ক্যালোরি পোড়ানো',
    'exercise.intensity': 'তীব্রতা',
    'exercise.low': 'কম',
    'exercise.medium': 'মাঝারি',
    'exercise.high': 'বেশি',
    'exercise.history': 'ওয়ার্কআউট ইতিহাস',
    'exercise.cardio': 'কার্ডিও',
    'exercise.strength': 'শক্তি',
    'exercise.flexibility': 'নমনীয়তা',
    'exercise.sports': 'খেলাধুলা',
    'exercise.workoutPlan': 'আজকের ওয়ার্কআউট প্ল্যান',
    'exercise.todaysTip': 'আজকের পরামর্শ',
    'exercise.missedYesterday': 'গতকাল মিস করা ওয়ার্কআউট',
    'exercise.progress': 'অগ্রগতি',
    'exercise.allComplete': 'অসাধারণ! আজকের সব ওয়ার্কআউট সম্পন্ন!',
    'exercise.noPlan': 'কোনো ওয়ার্কআউট প্ল্যান নেই',
    
    // Settings
    'settings.title': 'সেটিংস',
    'settings.language': 'ভাষা',
    'settings.theme': 'থিম',
    'settings.notifications': 'নোটিফিকেশন',
    'settings.editProfile': 'প্রোফাইল সম্পাদনা',
    'settings.about': 'সম্পর্কে',
    'settings.help': 'সাহায্য ও সমর্থন',
    'settings.privacy': 'গোপনীয়তা নীতি',
    'settings.deleteAccount': 'অ্যাকাউন্ট মুছুন',
    
    // Profile
    'profile.title': 'প্রোফাইল',
    'profile.basicInfo': 'মৌলিক তথ্য',
    'profile.healthInfo': 'স্বাস্থ্য তথ্য',
    'profile.goals': 'ফিটনেস লক্ষ্য',
    'profile.preferences': 'খাবারের পছন্দ',
    'profile.age': 'বয়স',
    'profile.height': 'উচ্চতা',
    'profile.weight': 'ওজন',
    'profile.gender': 'লিঙ্গ',
    'profile.male': 'পুরুষ',
    'profile.female': 'মহিলা',
    'profile.other': 'অন্যান্য',
    'profile.healthConditions': 'স্বাস্থ্য অবস্থা',
    'profile.dietaryRestrictions': 'খাদ্যতালিকাগত বিধিনিষেধ',
    'profile.allergies': 'অ্যালার্জি',
    'profile.fitnessGoal': 'ফিটনেস লক্ষ্য',
    'profile.weightLoss': 'ওজন কমানো',
    'profile.weightGain': 'ওজন বাড়ানো',
    'profile.maintenance': 'রক্ষণাবেক্ষণ',
    'profile.muscleGain': 'মাংসপেশী বাড়ানো',
    'profile.dislikedFoods': 'অপছন্দের খাবার',
    'profile.saveChanges': 'পরিবর্তন সংরক্ষণ করুন',
    'profile.saved': 'প্রোফাইল সফলভাবে সংরক্ষিত!',
    
    // Common
    'common.save': 'সংরক্ষণ',
    'common.cancel': 'বাতিল',
    'common.delete': 'মুছুন',
    'common.edit': 'সম্পাদনা',
    'common.add': 'যোগ করুন',
    'common.search': 'অনুসন্ধান',
    'common.loading': 'লোড হচ্ছে...',
    'common.error': 'কিছু ভুল হয়েছে',
    'common.success': 'সফল!',
    'common.today': 'আজ',
    'common.yesterday': 'গতকাল',
    'common.thisWeek': 'এই সপ্তাহ',
    'common.thisMonth': 'এই মাস',
    'common.kcal': 'কিলোক্যালোরি',
    'common.g': 'গ্রাম',
    'common.cm': 'সেমি',
    'common.kg': 'কেজি',
    'common.years': 'বছর',
    'common.min': 'মিনিট',
    'common.refresh': 'রিফ্রেশ',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('desi-nutri-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('desi-nutri-language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
