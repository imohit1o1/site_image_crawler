import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Rocket, Play, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type CrawlFormData } from "@/lib/types";

const formSchema = z.object({
  targetUrl: z.string().url("Please enter a valid URL"),
  maxPages: z.number().min(1, "Must be at least 1").max(1000, "Cannot exceed 1000"),
  timeout: z.number().min(2, "Must be at least 2 seconds").max(60, "Cannot exceed 60 seconds"),
  includeCssBackgrounds: z.boolean(),
});

interface CrawlerFormProps {
  onCrawlStart: (crawlId: string) => void;
  activeCrawlId: string | null;
}

export default function CrawlerForm({ onCrawlStart, activeCrawlId }: CrawlerFormProps) {
  const { toast } = useToast();
  
  const form = useForm<CrawlFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetUrl: "",
      maxPages: 100,
      timeout: 10,
      includeCssBackgrounds: true,
    },
  });

  const startCrawlMutation = useMutation({
    mutationFn: async (data: CrawlFormData) => {
      // Convert timeout from seconds to milliseconds for the API
      const apiData = { ...data, timeout: data.timeout * 1000 };
      const response = await apiRequest('POST', '/api/crawl', apiData);
      return response.json();
    },
    onSuccess: (data) => {
      onCrawlStart(data.id);
      toast({
        title: "Crawl Started",
        description: "The image crawling process has begun.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start crawl",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CrawlFormData) => {
    startCrawlMutation.mutate(data);
  };

  const isDisabled = !!activeCrawlId || startCrawlMutation.isPending;

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Rocket className="text-primary" size={18} />
          <h2 className="text-base font-semibold">Start Crawling</h2>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* URL Input */}
            <FormField
              control={form.control}
              name="targetUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">
                    Target Website URL
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type="url"
                        placeholder="https://example.com"
                        className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        data-testid="input-target-url"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <Globe className="text-gray-400" size={16} />
                      </div>
                    </div>
                  </FormControl>
                  <p className="text-xs text-gray-500">Only same-origin pages will be crawled</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Crawl Options */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-medium text-gray-900">Crawl Options</h3>
              
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="maxPages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Max Pages</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          max="1000"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          className="text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary py-2"
                          data-testid="input-max-pages"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="timeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Timeout (sec)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="2"
                          max="60"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          className="text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary py-2"
                          data-testid="input-timeout"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeCssBackgrounds"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-0">
                      <FormLabel className="text-sm font-medium text-gray-700 mb-2">CSS Backgrounds</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          data-testid="checkbox-include-css-bg"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit"
              disabled={isDisabled}
              className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-start-crawl"
            >
              <Play className="mr-2" size={16} />
              {startCrawlMutation.isPending ? "Starting..." : "Start Crawling"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
