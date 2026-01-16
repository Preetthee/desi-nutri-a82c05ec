import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Loader2, 
  Check, 
  X, 
  Coffee, 
  Sun, 
  Moon, 
  Cookie,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ImageUploadButton from '@/components/shared/ImageUploadButton';
import VoiceInputButton from '@/components/shared/VoiceInputButton';

interface ParsedFood {
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: string | null;
  selected: boolean;
}

interface AIFoodInputProps {
  onFoodAdded: () => void;
}

export default function AIFoodInput({ onFoodAdded }: AIFoodInputProps) {
  const { user, session } = useAuth();
  const { t } = useLanguage();
  const [description, setDescription] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedFoods, setParsedFoods] = useState<ParsedFood[]>([]);
  const [showParsed, setShowParsed] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleVoiceTranscript = (text: string) => {
    setDescription(prev => prev ? `${prev} ${text}` : text);
  };

  const mealTypes = [
    { id: 'breakfast', label: t('tracker.breakfast'), icon: Coffee },
    { id: 'lunch', label: t('tracker.lunch'), icon: Sun },
    { id: 'dinner', label: t('tracker.dinner'), icon: Moon },
    { id: 'snack', label: t('tracker.snacks'), icon: Cookie },
  ];

  const handleParse = async () => {
    if ((!description.trim() && !selectedImage) || !session) return;

    setParsing(true);
    setParsedFoods([]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-food`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            description: description.trim(),
            defaultMealType: selectedMealType || null,
            image: selectedImage,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 402) {
          toast.error('AI credits exhausted. Please add credits to continue.');
        } else {
          toast.error(errorData.error || 'Failed to parse food');
        }
        return;
      }

      const data = await response.json();
      
      if (data.foods && data.foods.length > 0) {
        const foodsWithSelection = data.foods.map((food: any) => ({
          ...food,
          selected: true,
        }));
        setParsedFoods(foodsWithSelection);
        setShowParsed(true);

        // If no meal type was determined by AI, check if all foods have same type
        const types = [...new Set(data.foods.map((f: any) => f.meal_type).filter(Boolean))];
        if (types.length === 1) {
          setSelectedMealType(types[0] as string);
        }
      } else {
        toast.error('Could not identify any food items');
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to process food description');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const selectedFoods = parsedFoods.filter((f) => f.selected);
    if (selectedFoods.length === 0) {
      toast.error('Please select at least one food item');
      return;
    }

    // Check if meal type is needed
    const needsMealType = selectedFoods.some((f) => !f.meal_type && !selectedMealType);
    if (needsMealType) {
      toast.error('Please select a meal type');
      return;
    }

    setSaving(true);

    try {
      const foodsToInsert = selectedFoods.map((food) => ({
        user_id: user.id,
        meal_type: food.meal_type || selectedMealType,
        food_name: food.food_name,
        quantity: food.quantity,
        unit: food.unit,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
      }));

      const { error } = await supabase.from('food_logs').insert(foodsToInsert);

      if (error) throw error;

      toast.success(`Added ${selectedFoods.length} food item${selectedFoods.length > 1 ? 's' : ''}`);
      setDescription('');
      setSelectedImage(null);
      setParsedFoods([]);
      setShowParsed(false);
      setSelectedMealType('');
      onFoodAdded();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save food items');
    } finally {
      setSaving(false);
    }
  };

  const toggleFoodSelection = (index: number) => {
    setParsedFoods((prev) =>
      prev.map((food, i) =>
        i === index ? { ...food, selected: !food.selected } : food
      )
    );
  };

  const totalCalories = parsedFoods
    .filter((f) => f.selected)
    .reduce((sum, f) => sum + f.calories, 0);

  const canSubmit = (description.trim() || selectedImage) && selectedMealType;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-display font-semibold text-foreground">
            AI Food Logger
          </span>
        </div>

        <div className="flex gap-2 items-start">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you ate... e.g., 'Had 2 rotis with chicken curry and salad for lunch'"
            className="min-h-[80px] resize-none bg-background/80 flex-1"
            disabled={parsing || saving}
          />
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            disabled={parsing || saving}
          />
        </div>

        {!showParsed && (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <ImageUploadButton
                selectedImage={selectedImage}
                onImageSelect={setSelectedImage}
                onImageClear={() => setSelectedImage(null)}
                disabled={parsing || saving}
              />
              
              <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                <SelectTrigger className="w-[140px] bg-background/80">
                  <SelectValue placeholder="Meal type" />
                </SelectTrigger>
                <SelectContent>
                  {mealTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleParse}
                disabled={!canSubmit || parsing}
                className="flex-1 gap-2"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Add with AI
                  </>
                )}
              </Button>
            </div>
            
            {/* Hint when meal type not selected */}
            {!selectedMealType && (description.trim() || selectedImage) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-golden">↑</span> Select a meal type to continue
              </p>
            )}
          </div>
        )}

        {/* Parsed Foods Review */}
        {showParsed && parsedFoods.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Found {parsedFoods.length} item{parsedFoods.length > 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowParsed(false)}
                className="text-muted-foreground"
              >
                <ChevronUp className="w-4 h-4 mr-1" />
                Collapse
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {parsedFoods.map((food, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    food.selected
                      ? 'bg-background/80 border border-primary/30'
                      : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <Checkbox
                    checked={food.selected}
                    onCheckedChange={() => toggleFoodSelection(index)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {food.food_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ×{food.quantity} {food.unit}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="text-primary font-medium">{food.calories} kcal</span>
                      <span>P: {food.protein_g}g</span>
                      <span>C: {food.carbs_g}g</span>
                      <span>F: {food.fat_g}g</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Meal type selector if needed */}
            {parsedFoods.some((f) => !f.meal_type) && !selectedMealType && (
              <div className="p-3 rounded-lg bg-golden/10 border border-golden/30">
                <p className="text-sm text-foreground mb-2">Select meal type:</p>
                <div className="flex flex-wrap gap-2">
                  {mealTypes.map((type) => (
                    <Button
                      key={type.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMealType(type.id)}
                      className="gap-1"
                    >
                      <type.icon className="w-3 h-3" />
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary and actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold text-primary">{totalCalories} kcal</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParsedFoods([]);
                    setShowParsed(false);
                    setSelectedImage(null);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !parsedFoods.some((f) => f.selected)}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1" />
                  )}
                  Add Selected
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
