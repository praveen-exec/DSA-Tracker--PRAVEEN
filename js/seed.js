// Starter problem set. [title, LeetCode slug, topic, difficulty]
const rows = [
  ["Two Sum", "two-sum", "Arrays and Hashing", "easy"],
  ["Contains Duplicate", "contains-duplicate", "Arrays and Hashing", "easy"],
  ["Valid Anagram", "valid-anagram", "Arrays and Hashing", "easy"],
  ["Group Anagrams", "group-anagrams", "Arrays and Hashing", "medium"],
  ["Top K Frequent Elements", "top-k-frequent-elements", "Arrays and Hashing", "medium"],
  ["Product of Array Except Self", "product-of-array-except-self", "Arrays and Hashing", "medium"],

  ["Best Time to Buy and Sell Stock", "best-time-to-buy-and-sell-stock", "Two Pointers and Sliding Window", "easy"],
  ["Container With Most Water", "container-with-most-water", "Two Pointers and Sliding Window", "medium"],
  ["3Sum", "3sum", "Two Pointers and Sliding Window", "medium"],
  ["Longest Substring Without Repeating Characters", "longest-substring-without-repeating-characters", "Two Pointers and Sliding Window", "medium"],
  ["Trapping Rain Water", "trapping-rain-water", "Two Pointers and Sliding Window", "hard"],

  ["Valid Parentheses", "valid-parentheses", "Stack", "easy"],
  ["Min Stack", "min-stack", "Stack", "medium"],
  ["Daily Temperatures", "daily-temperatures", "Stack", "medium"],

  ["Binary Search", "binary-search", "Binary Search", "easy"],
  ["Search in Rotated Sorted Array", "search-in-rotated-sorted-array", "Binary Search", "medium"],
  ["Median of Two Sorted Arrays", "median-of-two-sorted-arrays", "Binary Search", "hard"],

  ["Reverse Linked List", "reverse-linked-list", "Linked List", "easy"],
  ["Merge Two Sorted Lists", "merge-two-sorted-lists", "Linked List", "easy"],
  ["Linked List Cycle", "linked-list-cycle", "Linked List", "easy"],
  ["LRU Cache", "lru-cache", "Linked List", "medium"],
  ["Merge k Sorted Lists", "merge-k-sorted-lists", "Linked List", "hard"],

  ["Maximum Depth of Binary Tree", "maximum-depth-of-binary-tree", "Trees", "easy"],
  ["Invert Binary Tree", "invert-binary-tree", "Trees", "easy"],
  ["Binary Tree Level Order Traversal", "binary-tree-level-order-traversal", "Trees", "medium"],
  ["Validate Binary Search Tree", "validate-binary-search-tree", "Trees", "medium"],

  ["Kth Largest Element in an Array", "kth-largest-element-in-an-array", "Heap and Intervals", "medium"],
  ["Merge Intervals", "merge-intervals", "Heap and Intervals", "medium"],

  ["Subsets", "subsets", "Backtracking", "medium"],
  ["Permutations", "permutations", "Backtracking", "medium"],
  ["Combination Sum", "combination-sum", "Backtracking", "medium"],

  ["Number of Islands", "number-of-islands", "Graphs", "medium"],
  ["Course Schedule", "course-schedule", "Graphs", "medium"],
  ["Word Ladder", "word-ladder", "Graphs", "hard"],

  ["Climbing Stairs", "climbing-stairs", "Dynamic Programming", "easy"],
  ["House Robber", "house-robber", "Dynamic Programming", "medium"],
  ["Coin Change", "coin-change", "Dynamic Programming", "medium"],
  ["Longest Increasing Subsequence", "longest-increasing-subsequence", "Dynamic Programming", "medium"],
  ["Longest Palindromic Substring", "longest-palindromic-substring", "Dynamic Programming", "medium"],
  ["Unique Paths", "unique-paths", "Dynamic Programming", "medium"],
  ["Edit Distance", "edit-distance", "Dynamic Programming", "medium"]
];

export const starterQuestions = rows.map(([title, slug, topic, difficulty]) => ({
  title,
  link: `https://leetcode.com/problems/${slug}/`,
  topic,
  difficulty,
  platform: "LeetCode"
}));
