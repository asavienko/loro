Top of any multi-step flow (onboarding, trip setup).

```jsx
<StepDots step={step} total={steps.length} onBack={step > 0 ? back : undefined} />
```

Steps animate in with the `stepIn` keyframe; the counter is tabular so it never shifts.
