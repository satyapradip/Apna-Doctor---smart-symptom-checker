// API service for AI analysis using Gemini
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

export interface SymptomAnalysisRequest {
  symptoms_text: string;
  severity: string;
  onset?: string;
  duration?: string;
  existing_conditions?: string;
  current_medications?: string;
  allergies?: string;
  age: number;
  is_pregnant: boolean;
}

export interface AnalysisResponse {
  triage_level: string;
  triage_reason: string;
  recommendations: {
    medicines: Array<{ name: string; dose?: string; notes?: string; evidence_level?: string }>;
    home_remedies: string[];
    what_to_do: string[];
    what_not_to_do: string[];
    doctor_specialization?: string;
    indian_emergency_contacts?: Array<{ service: string; number: string; description: string }>;
  };
  confidence_score: number;
  disclaimer: string;
}

function buildPrompt(symptoms: SymptomAnalysisRequest): string {
  const prompt = `You are a medical triage assistant for an educational demonstration tool. Analyze the following symptoms and provide structured health guidance.

SYMPTOM INFORMATION:
- Primary Symptoms: ${symptoms.symptoms_text}
- Severity Level: ${symptoms.severity}
- Patient Age: ${symptoms.age}
${symptoms.onset ? `- Symptom Onset: ${symptoms.onset}` : ""}
${symptoms.duration ? `- Duration: ${symptoms.duration}` : ""}
${symptoms.existing_conditions ? `- Existing Conditions: ${symptoms.existing_conditions}` : ""}
${symptoms.current_medications ? `- Current Medications: ${symptoms.current_medications}` : ""}
${symptoms.allergies ? `- Allergies: ${symptoms.allergies}` : ""}
${symptoms.is_pregnant ? "- Patient is pregnant" : ""}

CRITICAL SAFETY GUIDELINES:
1. If patient mentions chest pain, severe difficulty breathing, uncontrolled bleeding, sudden numbness, confusion, or loss of consciousness - return EMERGENCY triage only.
2. For ages < 2 or > 65, be conservative and escalate triage level.
3. For pregnant patients, automatically escalate at least one level.
4. ONLY suggest OTC medications - never prescribe medications.
5. If unsure about anything, escalate the triage level.

REQUIRED JSON RESPONSE FORMAT (RESPOND ONLY WITH VALID JSON, NO MARKDOWN):
Include doctor_specialization (which type of doctor to consult) and indian_emergency_contacts array in recommendations.
{
  "triage_level": "emergency" | "urgent-visit" | "see-doctor" | "self-care",
  "triage_reason": "Brief explanation of the triage decision",
  "recommendations": {
    "medicines": [
      {
        "name": "OTC medication name",
        "dose": "dose and frequency",
        "notes": "why this medication",
        "evidence_level": "Strong/Moderate/Supportive"
      }
    ],
    "home_remedies": ["remedy 1", "remedy 2"],
    "what_to_do": ["action 1", "action 2"],
    "what_not_to_do": ["avoid 1", "avoid 2"]
  },
  "confidence_score": 0.0 to 1.0,
  "disclaimer": "This is an educational tool only and not medical advice. Always consult healthcare professionals."
}

Remember: For emergencies, return only emergency triage with minimal recommendations.`;

  return prompt;
}

async function analyzeWithGemini(symptoms: SymptomAnalysisRequest): Promise<AnalysisResponse | null> {
  try {
    console.log("Attempting Gemini API call...");
    const prompt = buildPrompt(symptoms);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            topP: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Gemini API error:", error);
      console.error("Gemini API status:", response.status, response.statusText);
      console.error("Gemini API URL used:", `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("No content in Gemini response");
      return null;
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Gemini response:", content);
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log("✅ Gemini analysis successful with recommendations:", {
      triage: result.triage_level,
      medicines: result.recommendations?.medicines?.length || 0,
      remedies: result.recommendations?.home_remedies?.length || 0,
    });
    return result;
  } catch (error) {
    console.error("❌ Gemini API error:", error);
    return null;
  }
}


function ensureCompleteResponse(result: Record<string, unknown>): AnalysisResponse {
  const recs = result.recommendations as Record<string, unknown> | undefined;
  
  return {
    triage_level: (result.triage_level as string) || "see-doctor",
    triage_reason: (result.triage_reason as string) || "Assessment completed based on provided information",
    recommendations: {
      medicines: Array.isArray(recs?.medicines) 
        ? (recs.medicines as Array<Record<string, unknown>>).map((med) => ({
            name: (med.name as string) || "Unknown medication",
            dose: (med.dose as string) || undefined,
            notes: (med.notes as string) || undefined,
            evidence_level: (med.evidence_level as string) || undefined,
          }))
        : [],
      home_remedies: Array.isArray(recs?.home_remedies) 
        ? (recs.home_remedies as string[])
        : [],
      what_to_do: Array.isArray(recs?.what_to_do) 
        ? (recs.what_to_do as string[])
        : [],
      what_not_to_do: Array.isArray(recs?.what_not_to_do) 
        ? (recs.what_not_to_do as string[])
        : [],
    },
    confidence_score: typeof result.confidence_score === "number" 
      ? Math.min(Math.max(result.confidence_score, 0), 1) 
      : 0.5,
    disclaimer: (result.disclaimer as string) || "This is an educational tool only. Always consult with qualified healthcare professionals.",
  };
}

export async function analyzeSymptoms(symptoms: SymptomAnalysisRequest): Promise<AnalysisResponse> {
  console.log("Starting symptom analysis...", {
    symptoms_text: symptoms.symptoms_text.substring(0, 50),
    severity: symptoms.severity,
    age: symptoms.age,
  });

  // Try Gemini first
  let result = await analyzeWithGemini(symptoms);
  
  if (result) {
    console.log("✅ Gemini API successful - returning analysis with recommendations");
    return ensureCompleteResponse(result as unknown as Record<string, unknown>);
  }

  // Gemini failed — use built-in symptom keyword analysis as fallback

  console.warn("⚠️ Gemini API unavailable, using built-in symptom analysis fallback");
  
  const symptomsLower = symptoms.symptoms_text.toLowerCase();
  const severityMap: Record<string, string> = {
    "Low": "self-care",
    "Medium": "see-doctor",
    "High": "urgent-visit",
    "emergency-level": "emergency",
  };
  
  // Advanced emergency detection
  const emergencyKeywords = [
    'chest pain', 'difficulty breathing', 'severe bleeding', 'unconscious', 'seizure', 
    'stroke', 'heart attack', 'can\'t breathe', 'choking', 'severe head injury',
    'loss of consciousness', 'confusion', 'slurred speech', 'paralysis', 'severe burn'
  ];
  const isEmergency = emergencyKeywords.some(keyword => symptomsLower.includes(keyword));
  
  let triageLevel = severityMap[symptoms.severity] || "see-doctor";
  if (isEmergency) triageLevel = "emergency";
  
  // Advanced symptom analysis
  let medicines = [];
  let homeRemedies = [];
  let whatToDo = [];
  let whatNotToDo = [];
  let reason = "";
  let confidence = 0.45;
  let doctorSpecialization = "General Physician";
  
  // Indian Emergency Contacts
  const indianEmergencyContacts = [
    { service: "National Emergency Number", number: "112", description: "All emergency services (Police, Fire, Ambulance)" },
    { service: "Ambulance Service", number: "102", description: "Emergency ambulance service" },
    { service: "Medical Helpline", number: "104", description: "Medical emergency helpline" },
    { service: "Women Helpline", number: "1091", description: "For women in distress" },
    { service: "Child Helpline", number: "1098", description: "For children needing assistance" },
    { service: "Senior Citizen Helpline", number: "14567", description: "For senior citizens" },
    { service: "Mental Health Helpline", number: "08046110007", description: "Vandrevala Foundation 24/7 support" },
    { service: "Poison Control", number: "1800-116-117", description: "For poisoning emergencies" }
  ];
  
  // Multiple symptom combinations
  const hasHeadache = symptomsLower.includes('headache') || symptomsLower.includes('head pain') || symptomsLower.includes('migraine');
  const hasFever = symptomsLower.includes('fever') || symptomsLower.includes('temperature') || symptomsLower.includes('hot');
  const hasCough = symptomsLower.includes('cough') || symptomsLower.includes('cold') || symptomsLower.includes('congestion');
  const hasNausea = symptomsLower.includes('nausea') || symptomsLower.includes('vomit') || symptomsLower.includes('throw up');
  const hasStomach = symptomsLower.includes('stomach') || symptomsLower.includes('abdominal') || symptomsLower.includes('belly');
  const hasDiarrhea = symptomsLower.includes('diarrhea') || symptomsLower.includes('loose stool');
  const hasSoreThroat = symptomsLower.includes('sore throat') || symptomsLower.includes('throat pain');
  const hasBodyPain = symptomsLower.includes('body pain') || symptomsLower.includes('ache') || symptomsLower.includes('muscle pain');
  const hasDizziness = symptomsLower.includes('dizzy') || symptomsLower.includes('vertigo') || symptomsLower.includes('lightheaded');
  const hasFatigue = symptomsLower.includes('tired') || symptomsLower.includes('fatigue') || symptomsLower.includes('weak');
  
  // Combination patterns for better diagnosis
  if (hasFever && hasCough && hasSoreThroat) {
    // Flu-like symptoms
    reason = "Your symptoms suggest a possible flu or upper respiratory infection with fever, cough, and sore throat.";
    doctorSpecialization = "General Physician or ENT (Ear, Nose, Throat) Specialist";
    medicines = [
      { name: "Acetaminophen (Tylenol)", dose: "650-1000mg every 6 hours", notes: "Reduces fever and pain" },
      { name: "Dextromethorphan (Robitussin DM)", dose: "10-20mg every 4 hours", notes: "Suppresses cough" },
      { name: "Throat lozenges", dose: "As needed", notes: "Soothes sore throat" }
    ];
    homeRemedies = [
      "Turmeric milk (Haldi doodh) before bedtime for anti-inflammatory benefits",
      "Steam inhalation with eucalyptus oil or ajwain (carom seeds)",
      "Kadha - Boil tulsi, ginger, black pepper, honey in water",
      "Rest for 7-10 days to allow body to recover",
      "Drink warm fluids like herbal tea with honey",
      "Gargle with warm salt water or turmeric water for throat relief",
      "Ginger-honey mixture for cough relief"
    ];
    whatToDo = [
      "Monitor temperature every 4 hours",
      "Stay isolated to avoid spreading infection",
      "Get plenty of rest and sleep",
      "If fever persists beyond 3 days, see a doctor",
      "Watch for difficulty breathing or chest pain"
    ];
    whatNotToDo = [
      "Do not go to work or public places",
      "Avoid cold foods and drinks",
      "Do not share utensils or towels",
      "Avoid smoking or secondhand smoke"
    ];
    confidence = 0.75;
    triageLevel = symptoms.severity === "High" ? "urgent-visit" : "see-doctor";
    
  } else if (hasHeadache && hasNausea && hasDizziness) {
    // Migraine or severe headache
    reason = "Combination of headache, nausea, and dizziness suggests possible migraine or severe tension headache.";
    doctorSpecialization = "Neurologist (for chronic migraines) or General Physician";
    medicines = [
      { name: "Ibuprofen (Advil)", dose: "400-600mg immediately", notes: "Anti-inflammatory for headache" },
      { name: "Acetaminophen (Tylenol)", dose: "1000mg", notes: "Alternative pain relief" },
      { name: "Ondansetron (Zofran)", dose: "4-8mg if prescribed", notes: "For severe nausea" }
    ];
    homeRemedies = [
      "Apply sandalwood paste on forehead for cooling effect",
      "Drink buttermilk or coconut water to stay hydrated",
      "Rest in a completely dark, quiet room",
      "Apply cold compress to forehead and neck",
      "Light pressure massage on temples with peppermint oil",
      "Inhale lavender or eucalyptus oil aromatherapy",
      "Tulsi (holy basil) tea for relaxation"
    ];
    whatToDo = [
      "Lie down in dark room immediately",
      "Track headache patterns in a diary",
      "Identify and avoid trigger foods",
      "See a neurologist if headaches are frequent",
      "Consider preventive medications"
    ];
    whatNotToDo = [
      "Avoid bright lights and loud noises",
      "Do not skip meals",
      "Avoid caffeine withdrawal",
      "Do not use screens or phones"
    ];
    confidence = 0.70;
    triageLevel = symptoms.severity === "High" ? "urgent-visit" : "see-doctor";
    
  } else if (hasNausea && hasDiarrhea && hasStomach) {
    // Gastroenteritis
    reason = "Symptoms indicate possible gastroenteritis (stomach flu) or food poisoning with nausea, vomiting, and diarrhea.";
    doctorSpecialization = "Gastroenterologist or General Physician";
    medicines = [
      { name: "Loperamide (Imodium)", dose: "2mg after each loose stool", notes: "Stops diarrhea" },
      { name: "Bismuth subsalicylate (Pepto-Bismol)", dose: "30ml every 30-60 min", notes: "Settles stomach" },
      { name: "Oral Rehydration Solution (ORS)", dose: "Frequent small amounts", notes: "Prevents dehydration" }
    ];
    homeRemedies = [
      "Jeera (cumin) water - boil 1 tsp cumin seeds in water",
      "Curd (yogurt) with rock salt after symptoms reduce",
      "Pomegranate juice for hydration and nutrients",
      "Rice water (kanji) - very effective for diarrhea",
      "BRAT diet: Bananas, Rice, Applesauce, Toast",
      "Clear broths and nimbu pani (lemon water with salt & sugar)",
      "Ginger tea or ginger juice with honey",
      "Small frequent sips of water",
      "Buttermilk (chaas) after 24 hours"
    ];
    whatToDo = [
      "Monitor hydration - check urine color",
      "Rest and avoid solid foods for 6-12 hours",
      "Gradually reintroduce bland foods",
      "If no improvement in 48 hours, see doctor",
      "Watch for signs of severe dehydration"
    ];
    whatNotToDo = [
      "Avoid dairy products for 2-3 days (except curd)",
      "No spicy, fatty, or fried foods",
      "Avoid alcohol and caffeine",
      "Do not take anti-diarrhea meds if you have bloody stool"
    ];
    confidence = 0.72;
    triageLevel = symptoms.severity === "High" ? "urgent-visit" : "self-care";
    
  } else if (hasHeadache && hasFever) {
    // Fever with headache
    reason = "Fever combined with headache may indicate an infection or inflammation.";
    doctorSpecialization = "General Physician";
    medicines = [
      { name: "Ibuprofen (Advil)", dose: "400mg every 6 hours", notes: "Reduces both fever and headache" },
      { name: "Acetaminophen (Tylenol)", dose: "650mg every 4-6 hours", notes: "Alternative fever reducer" }
    ];
    homeRemedies = [
      "Tulsi (holy basil) and ginger kadha - immune booster",
      "Cool compress with water and few drops of sandalwood oil",
      "Drink plenty of water and coconut water",
      "Rest in a cool, dark room",
      "Light khichdi or porridge meals only"
    ];
    confidence = 0.68;
    
  } else if (hasHeadache) {
    // Just headache
    reason = `You're experiencing a ${symptoms.severity.toLowerCase()}-severity headache.`;
    doctorSpecialization = "General Physician (or Neurologist if chronic)";
    medicines = [
      { name: "Ibuprofen (Advil)", dose: "200-400mg every 4-6 hours", notes: "First-line treatment for headaches" },
      { name: "Acetaminophen (Tylenol)", dose: "500-1000mg every 4-6 hours", notes: "Alternative pain relief" },
      { name: "Aspirin", dose: "325-650mg every 4 hours", notes: "If not allergic" }
    ];
    homeRemedies = [
      "Apply chandan (sandalwood) paste on forehead",
      "Drink fresh mint (pudina) tea or inhale mint oil",
      "Rest in a dark, quiet room for 20-30 minutes",
      "Apply cold compress to forehead for 15 minutes",
      "Drink a full glass of water (dehydration can cause headaches)",
      "Gentle neck and shoulder stretches",
      "Amla (Indian gooseberry) juice for vitamin C"
    ];
    confidence = 0.65;
    
  } else if (hasCough || hasSoreThroat) {
    // Respiratory symptoms
    reason = "You have respiratory symptoms suggesting a cold or throat infection.";
    doctorSpecialization = "ENT Specialist or General Physician";
    medicines = [
      { name: "Dextromethorphan (Robitussin)", dose: "10-20mg every 4 hours", notes: "Cough suppressant" },
      { name: "Guaifenesin (Mucinex)", dose: "200-400mg every 4 hours", notes: "Thins mucus" },
      { name: "Throat lozenges with menthol", dose: "As needed", notes: "Soothes throat" }
    ];
    homeRemedies = [
      "Honey and warm lemon water (Shahad-nimbu pani)",
      "Turmeric milk at bedtime (Haldi doodh)",
      "Steam inhalation with ajwain or eucalyptus oil 2-3 times daily",
      "Gargle with warm salt water or turmeric water",
      "Tulsi (holy basil) leaves tea with ginger and honey",
      "Mulethi (licorice) powder mixed with honey",
      "Avoid cold drinks and ice cream"
    ];
    confidence = 0.70;
    
  } else if (hasFever) {
    // Just fever
    reason = `You have a ${symptoms.severity.toLowerCase()}-grade fever.`;
    doctorSpecialization = "General Physician";
    medicines = [
      { name: "Acetaminophen (Tylenol)", dose: "650-1000mg every 6 hours", notes: "Primary fever reducer" },
      { name: "Ibuprofen (Advil)", dose: "400mg every 6 hours", notes: "Alternative fever reducer" }
    ];
    homeRemedies = [
      "Kadha (herbal decoction) - tulsi, ginger, cinnamon, black pepper",
      "Giloy (Tinospora cordifolia) juice - immune booster",
      "Cool sponge bath with water (not ice cold)",
      "Drink plenty of water, coconut water, and nimbu pani",
      "Light, breathable cotton clothing",
      "Rest in a cool, well-ventilated room",
      "Monitor temperature every 2-4 hours"
    ];
    confidence = 0.68;
    
  } else if (hasNausea || hasStomach) {
    // Digestive issues
    reason = "You're experiencing digestive discomfort with nausea or stomach upset.";
    doctorSpecialization = "Gastroenterologist or General Physician";
    medicines = [
      { name: "Bismuth subsalicylate (Pepto-Bismol)", dose: "30ml every 30-60 min", notes: "Settles stomach" },
      { name: "Antacids (Tums)", dose: "2-4 tablets as needed", notes: "If heartburn present" }
    ];
    homeRemedies = [
      "Ajwain (carom seeds) water - soak overnight and drink",
      "Jeera (cumin) water - boil and drink warm",
      "Fresh ginger juice with honey",
      "Pudina (mint) chutney or tea",
      "Hing (asafoetida) in warm water for gas relief",
      "Small, bland meals (khichdi, crackers, toast)",
      "Avoid lying down for 2 hours after eating"
    ];
    confidence = 0.65;
    
  } else {
    // Generic symptoms
    reason = `Based on your ${symptoms.severity.toLowerCase()}-severity symptoms (${symptoms.symptoms_text}), general supportive care is recommended.`;
    doctorSpecialization = "General Physician";
    medicines = [
      { name: "Ibuprofen (Advil)", dose: "200-400mg every 6 hours", notes: "For pain and inflammation" },
      { name: "Acetaminophen (Tylenol)", dose: "500-1000mg every 6 hours", notes: "For pain relief" }
    ];
    homeRemedies = [
      "Tulsi (holy basil) tea - natural immunity booster",
      "Amla (Indian gooseberry) juice for vitamin C",
      "Adequate rest and sleep (8+ hours)",
      "Stay well hydrated - 8-10 glasses water daily",
      "Balanced diet with dal, vegetables, and fruits",
      "Light yoga or walking if feeling able",
      "Stress reduction through pranayama (breathing exercises)"
    ];
    confidence = 0.50;
  }
  
  // Common what to do and not do if not set
  if (whatToDo.length === 0) {
    whatToDo = [
      triageLevel === "emergency" ? "Call emergency services immediately" : 
      triageLevel === "urgent-visit" ? "Visit urgent care or ER within 24 hours" :
      triageLevel === "see-doctor" ? "Schedule appointment with doctor within 2-3 days" :
      "Monitor symptoms and self-care at home",
      "Keep track of symptom changes",
      "Stay hydrated and rest",
      "Take medications as recommended",
      "Avoid strenuous activities"
    ];
  }
  
  if (whatNotToDo.length === 0) {
    whatNotToDo = [
      "Do not ignore worsening symptoms",
      "Avoid self-diagnosing serious conditions",
      "Do not exceed recommended medication doses",
      "Avoid alcohol and smoking",
      triageLevel === "emergency" ? "Do not drive - call ambulance" : "Do not delay seeking help if symptoms worsen"
    ];
  }
  
  // Age-based adjustments
  if (symptoms.age < 12) {
    confidence -= 0.1;
    whatToDo.unshift("Consult pediatrician for children under 12");
  }
  if (symptoms.age > 65) {
    confidence -= 0.05;
    triageLevel = triageLevel === "self-care" ? "see-doctor" : triageLevel;
    whatToDo.unshift("Seniors should consult doctor for any concerning symptoms");
  }
  
  // Pregnancy considerations
  if (symptoms.is_pregnant) {
    confidence -= 0.1;
    triageLevel = triageLevel === "self-care" ? "see-doctor" : triageLevel;
    whatToDo.unshift("Pregnant women should consult OB-GYN before taking any medications");
    whatNotToDo.unshift("Avoid NSAIDs (Ibuprofen) during pregnancy - use Acetaminophen only if approved by doctor");
  }
  
  // Existing conditions
  if (symptoms.existing_conditions) {
    confidence -= 0.1;
    whatToDo.push(`Inform doctor about existing conditions: ${symptoms.existing_conditions}`);
  }
  
  // Allergies
  if (symptoms.allergies) {
    whatNotToDo.unshift(`Do not take medications you're allergic to: ${symptoms.allergies}`);
  }
  
  return {
    triage_level: triageLevel,
    triage_reason: reason || `Based on your ${symptoms.severity} severity symptoms, ${isEmergency ? 'immediate medical attention is required' : 'medical consultation is recommended'}.`,
    recommendations: {
      medicines: medicines.length > 0 ? medicines : [{ name: "Consult pharmacist", dose: "Before any medication", notes: "Get personalized advice" }],
      home_remedies: homeRemedies.length > 0 ? homeRemedies : ["Rest", "Hydration", "Healthy diet"],
      what_to_do: whatToDo,
      what_not_to_do: whatNotToDo,
      doctor_specialization: doctorSpecialization,
      indian_emergency_contacts: indianEmergencyContacts,
    },
    confidence_score: Math.max(0.35, Math.min(0.85, confidence)),
    disclaimer: "This is an automated assessment based on symptom keywords. Always consult qualified healthcare professionals for accurate diagnosis and treatment. Call emergency services for life-threatening conditions.",
  };
}
