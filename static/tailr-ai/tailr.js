let mode = "builder";

document.getElementById("builderBtn").onclick = () => mode = "builder";
document.getElementById("tailorBtn").onclick = () => mode = "tailor";

document.getElementById("runBtn").onclick = async () => {
    const text = document.getElementById("inputText").value;
    const output = document.getElementById("output");

    output.textContent = "Processing...";

    const res = await fetch("/api/tailr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text })
    });

    const data = await res.json();
    output.textContent = data.choices?.[0]?.message?.content || "No response";
};

