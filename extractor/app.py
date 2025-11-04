from flask import Flask, request, jsonify, render_template
import re
import os

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")
    
@app.route("/convert", methods=["POST"])
def convert():
    data = request.json
    array_name = data.get("arrayName", "array_name")
    raw_text = data.get("rawData", "")
    
    # Parse the table into float arrays
    rows = raw_text.strip().splitlines()
    output = []
    for row in rows:
        # Match optional negative sign, digits, optional decimal separator with digits
        matches = re.findall(r"-?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?", row)
        print(matches)
        if not matches:
            continue  # Skip lines with no valid numeric values
        # Normalize decimal separator to dot for float conversion
        numbers = [float(val.replace(',', '.')) for val in matches]
        output.append(numbers)
    
    # Format as NumPy-like array
    result = f"{array_name} = np.array([\n"
    for row in output:
        result += "    " + str(row) + ",\n"
    result += "])"

    return jsonify({"converted": result})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
