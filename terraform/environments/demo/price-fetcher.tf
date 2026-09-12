resource "aws_secretsmanager_secret" "gold_api_key" {
  name                    = "facet/demo/gold-api-key"
  description             = "Service-owned GoldAPI.io key, stored as a plain secret string"
  recovery_window_in_days = 30
}

# Populate AWSCURRENT outside Terraform before enabling the Lambda. Reading the
# value here makes it sensitive, but still stores it in Terraform state.
data "aws_secretsmanager_secret_version" "gold_api_key" {
  count     = var.price_fetcher_package_path == null ? 0 : 1
  secret_id = aws_secretsmanager_secret.gold_api_key.id
}

data "aws_iam_policy_document" "price_fetcher_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "price_fetcher" {
  count              = var.price_fetcher_package_path == null ? 0 : 1
  name               = "facet-demo-price-fetcher"
  assume_role_policy = data.aws_iam_policy_document.price_fetcher_assume_role.json
}

resource "aws_cloudwatch_log_group" "price_fetcher" {
  count             = var.price_fetcher_package_path == null ? 0 : 1
  name              = "/aws/lambda/facet-demo-price-fetcher"
  retention_in_days = 14
}

data "aws_iam_policy_document" "price_fetcher_logs" {
  count = var.price_fetcher_package_path == null ? 0 : 1
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.price_fetcher[0].arn}:*"]
  }
}

resource "aws_iam_role_policy" "price_fetcher_logs" {
  count  = var.price_fetcher_package_path == null ? 0 : 1
  role   = aws_iam_role.price_fetcher[0].id
  policy = data.aws_iam_policy_document.price_fetcher_logs[0].json
}

resource "aws_lambda_function" "price_fetcher" {
  count            = var.price_fetcher_package_path == null ? 0 : 1
  function_name    = "facet-demo-price-fetcher"
  role             = aws_iam_role.price_fetcher[0].arn
  runtime          = "nodejs22.x"
  handler          = "dist/src/handler.handler"
  filename         = var.price_fetcher_package_path
  source_code_hash = filebase64sha256(var.price_fetcher_package_path)
  timeout          = 15
  memory_size      = 128

  environment {
    variables = {
      GOLD_API_KEY = data.aws_secretsmanager_secret_version.gold_api_key[0].secret_string
    }
  }

  depends_on = [aws_iam_role_policy.price_fetcher_logs]
}
