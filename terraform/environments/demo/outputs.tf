output "frontend_bucket_name" {
  description = "Private S3 bucket receiving the built frontend assets."
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_url" {
  description = "CloudFront URL for the IP-restricted demo frontend."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}