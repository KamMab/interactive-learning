import type { Chapter, Course, Professor } from "./types";
import { DEFAULT_SETTINGS } from "./types";

// Shown only when Supabase isn't connected yet, so the site has something to click through.
export const SEED_COURSES: Course[] = [
  {
    id: "demo-course",
    slug: "demo-accounting",
    code: "DEMO 101",
    title: "Sample Accounting Course",
    description: "Placeholder content so you can try every study mode before connecting your database.",
    instructions: "",
    sort: 0,
    published: true,
  },
];

// A student-made "for fun" set, to show Map mode and the For Fun shelf in demo mode.
export const SEED_FUN_COURSE: Course = {
  id: "demo-fun", slug: "us-state-capitals-demo", code: "FUN", title: "US State Capitals",
  description: "Find each capital's state on the map.", instructions: "", sort: 0, published: true,
  owner_id: "demo-user", kind: "fun", visibility: "public",
};
export const SEED_AUTHOR = { user_id: "demo-user", handle: "joebruin", display_name: "Joe Bruin" };

export const SEED_PROFESSORS: Professor[] = [
  { id: "demo-prof-a", course_id: "demo-course", slug: "rivera", name: "Prof. Maria Rivera", instructions: "", sort: 0, published: true },
  { id: "demo-prof-b", course_id: "demo-course", slug: "chen", name: "Prof. David Chen", instructions: "", sort: 1, published: true },
];

export const SEED_CHAPTERS: Chapter[] = [
  {
    id: "demo-ch1",
    course_id: "demo-course",
    professor_id: null,
    number: 1,
    title: "Accrual Accounting Basics",
    instructions: "",
    published: true,
    settings: { ...DEFAULT_SETTINGS },
    content: {
      summary: "Revenue is recorded when earned and expenses when incurred, regardless of when cash moves.",
      sections: [
        { id: "sec-accruals", title: "Accruals" },
        { id: "sec-deferrals", title: "Deferrals" },
        { id: "sec-principles", title: "Matching and adjusting entries" },
      ],
      terms: [
        { id: "t1", section: "sec-accruals", term: "Accrued revenue", definition: "Revenue earned but not yet received in cash or recorded." },
        { id: "t2", section: "sec-deferrals", term: "Deferred revenue", definition: "Cash received before the revenue is earned; recorded as a liability." },
        { id: "t3", section: "sec-accruals", term: "Accrued expense", definition: "An expense incurred but not yet paid or recorded." },
        { id: "t4", section: "sec-deferrals", term: "Prepaid expense", definition: "Cash paid in advance for a future benefit; recorded as an asset." },
        { id: "t5", section: "sec-principles", term: "Matching principle", definition: "Expenses are recognized in the same period as the revenue they help generate." },
        { id: "t6", section: "sec-principles", term: "Adjusting entry", definition: "An end-of-period entry that updates accounts to reflect accruals and deferrals." },
      ],
      questions: [
        {
          id: "q1",
          section: "sec-deferrals",
          prompt: "A company receives $1,200 on Dec 1 for 12 months of service starting that day. How much revenue is recognized by Dec 31?",
          choices: ["$0", "$100", "$1,100", "$1,200"],
          answer: 1,
          explanation: "One month of the 12-month service has been earned: $1,200 / 12 = $100.",
        },
        {
          id: "q2",
          section: "sec-deferrals",
          prompt: "Unearned (deferred) revenue is reported as a:",
          choices: ["Revenue", "Asset", "Liability", "Equity"],
          answer: 2,
          explanation: "The company owes the customer future service, so it's a liability until earned.",
        },
        {
          id: "q3",
          section: "sec-accruals",
          prompt: "Which adjusting entry records wages earned by employees but unpaid at year-end?",
          choices: [
            "Dr Wages Payable, Cr Cash",
            "Dr Wages Expense, Cr Wages Payable",
            "Dr Prepaid Wages, Cr Cash",
            "Dr Cash, Cr Wages Expense",
          ],
          answer: 1,
          explanation: "The expense was incurred this period and the obligation is still owed.",
        },
        {
          id: "q4",
          section: "sec-accruals",
          prompt: "Failing to record accrued interest revenue will cause net income to be:",
          choices: ["Overstated", "Understated", "Unaffected", "Overstated, then corrected automatically"],
          answer: 1,
          explanation: "Revenue that was earned is missing, so income is too low.",
        },
      ],
      entries: [
        {
          id: "e1",
          section: "sec-accruals",
          scenario: "On Dec 31, $500 of interest has been earned on a note receivable but not yet collected.",
          lines: [
            { account: "Interest Receivable", debit: 500, credit: 0 },
            { account: "Interest Revenue", debit: 0, credit: 500 },
          ],
          explanation: "Accrued revenue: record the receivable and the revenue earned.",
        },
        {
          id: "e2",
          section: "sec-deferrals",
          scenario: "On Jan 1, the company pays $2,400 cash for a one-year insurance policy.",
          lines: [
            { account: "Prepaid Insurance", debit: 2400, credit: 0 },
            { account: "Cash", debit: 0, credit: 2400 },
          ],
          explanation: "The payment buys a future benefit, so it's an asset until used.",
        },
      ],
    },
  },
  {
    id: "demo-fun-1",
    course_id: "demo-fun",
    professor_id: null,
    number: 1,
    title: "US State Capitals",
    instructions: "",
    published: true,
    settings: { ...DEFAULT_SETTINGS, modes: ["learn", "map", "flashcards", "match", "quiz"] },
    content: {
      summary: "Twelve big states and their capitals. Learn them, then find them on the map.",
      labels: { front: "State", back: "Capital" },
      terms: [
        { id: "cap0", term: "California", definition: "Sacramento" },
        { id: "cap1", term: "Texas", definition: "Austin" },
        { id: "cap2", term: "New York", definition: "Albany" },
        { id: "cap3", term: "Florida", definition: "Tallahassee" },
        { id: "cap4", term: "Illinois", definition: "Springfield" },
        { id: "cap5", term: "Washington", definition: "Olympia" },
        { id: "cap6", term: "Nevada", definition: "Carson City" },
        { id: "cap7", term: "Pennsylvania", definition: "Harrisburg" },
        { id: "cap8", term: "Oregon", definition: "Salem" },
        { id: "cap9", term: "Arizona", definition: "Phoenix" },
        { id: "cap10", term: "Colorado", definition: "Denver" },
        { id: "cap11", term: "Georgia", definition: "Atlanta" }
      ],
      questions: [
        { id: "cq1", prompt: "Which capital is NOT the largest city in its state?", choices: ["Sacramento", "Phoenix", "Denver", "Atlanta"], answer: 0, explanation: "Los Angeles is California's largest city; Phoenix, Denver and Atlanta are the largest in theirs." },
        { id: "cq2", prompt: "Springfield is the capital of which state?", choices: ["Illinois", "Missouri", "Massachusetts", "Ohio"], answer: 0, explanation: "Illinois. (Missouri and Massachusetts have Springfields too, but they aren't capitals.)" },
        { id: "cq3", prompt: "Which state's capital is Olympia?", choices: ["Washington", "Oregon", "Idaho", "Montana"], answer: 0, explanation: "Olympia is Washington's capital; Seattle is the largest city." },
      ],
      entries: [],
      map: {
        region: "us-states",
        ask: "Click the state whose capital is",
        items: [
          { id: "m0", place: "California", prompt: "Sacramento" },
          { id: "m1", place: "Texas", prompt: "Austin" },
          { id: "m2", place: "New York", prompt: "Albany" },
          { id: "m3", place: "Florida", prompt: "Tallahassee" },
          { id: "m4", place: "Illinois", prompt: "Springfield" },
          { id: "m5", place: "Washington", prompt: "Olympia" },
          { id: "m6", place: "Nevada", prompt: "Carson City" },
          { id: "m7", place: "Pennsylvania", prompt: "Harrisburg" },
          { id: "m8", place: "Oregon", prompt: "Salem" },
          { id: "m9", place: "Arizona", prompt: "Phoenix" },
          { id: "m10", place: "Colorado", prompt: "Denver" },
          { id: "m11", place: "Georgia", prompt: "Atlanta" }
        ],
      },
    },
  },
];
