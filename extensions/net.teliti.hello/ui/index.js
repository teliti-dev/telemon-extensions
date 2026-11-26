export default {
  activate(sdk) {
    const h = sdk.React.createElement
    const { Card, CardHeader, CardTitle, CardContent } = sdk.ui
    sdk.registerWidget({
      type: "hello", size: { w: 6, h: 48 },
      Component: () => h(Card, { "data-testid": "ext-hello" }, h(CardHeader, null, h(CardTitle, null, "Halo dari extension")), h(CardContent, null, "level=" + sdk.accessLevel + " | report=" + sdk.can("view-report") + " | run=" + sdk.can("run"))),
    })
    sdk.registerPage({ id: "home", Component: () => h("div", { "data-testid": "ext-page" }, "Dasbor Hello: level=" + sdk.accessLevel + " run=" + sdk.can("run")) })
  },
}
