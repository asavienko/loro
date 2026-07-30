Every Loro screen opens with exactly one of these. The variant is not decoration — it declares the surface class, and with it the exit rule.

```jsx
<ScreenHeader variant="push" backLabel="Today" action="Filter" onBack={pop} />
<ScreenHeader variant="session" progress={0.48} position="rep 3/6" onBack={askToExit} />
```

Rules that travel with it: root has no back; push names its target; session shows a dismiss and no title; flow's back steps within the flow; a sheet has no header at all (it has a grip). A push route entered with an empty stack renders the ✕ form labelled with the resolved home.
